"""A password on the door of a deployed copy.

A deployment is shared by sending someone a link, so the link is the only
thing standing between the workspace and everyone else. HTTP Basic in front
of the whole app is the cheapest lock that every browser already knows how
to open, and one middleware covers the static files and the event streams
without a decorator on each route.

The middleware is plain ASGI rather than a BaseHTTPMiddleware subclass,
because BaseHTTPMiddleware wraps the response and a wrapped response
buffers a stream that is supposed to arrive a stage at a time.

Setting no password leaves the door open, which is what a local run wants.
"""

from __future__ import annotations

import base64
import binascii
import secrets

from starlette.requests import Request
from starlette.responses import PlainTextResponse
from starlette.types import ASGIApp, Receive, Scope, Send

CHALLENGE = {"WWW-Authenticate": 'Basic realm="orla", charset="UTF-8"'}

# The load balancer in front of a deployment has no password, so one path
# answers without being asked for one. A probe that got 401 would read the
# service as down and take it out of service.
OPEN_PATH = "/healthz"


def credentials(header: str) -> tuple[str, str] | None:
    """The user and password carried by an Authorization header. None when
    the header is missing, names another scheme, or does not decode."""

    scheme, _, encoded = header.partition(" ")
    if scheme.lower() != "basic":
        return None
    try:
        decoded = base64.b64decode(encoded, validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError, ValueError):
        return None
    user, separator, password = decoded.partition(":")
    return (user, password) if separator else None


class BasicAuth:
    def __init__(self, app: ASGIApp, username: str, password: str) -> None:
        self.app = app
        self.username = username
        self.password = password

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or self.allows(Request(scope)):
            await self.app(scope, receive, send)
            return
        refusal = PlainTextResponse("Not authorised.", status_code=401, headers=CHALLENGE)
        await refusal(scope, receive, send)

    def allows(self, request: Request) -> bool:
        if request.url.path == OPEN_PATH:
            return True
        found = credentials(request.headers.get("authorization", ""))
        if found is None:
            return False
        user, password = found
        # compare_digest refuses two strings unless both are ASCII, so the
        # comparison is made on bytes and a password with an accent in it
        # answers 401 rather than raising. Both comparisons run before they
        # are combined, so a wrong user takes as long to reject as a wrong
        # password.
        user_matches = secrets.compare_digest(user.encode(), self.username.encode())
        password_matches = secrets.compare_digest(password.encode(), self.password.encode())
        return user_matches and password_matches

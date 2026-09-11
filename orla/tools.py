"""Offline implementations of the tool catalog.

Every tool runs locally and needs no credentials, so a sketched workflow is
runnable the moment it is drawn. Replacing one of these with a real
integration is a change to a single function.
"""

from __future__ import annotations

import itertools
from collections.abc import Callable
from pathlib import Path

from simpleeval import SimpleEval

POLICIES: list[tuple[str, str]] = [
    (
        "refunds",
        "A full refund is available within 30 days of purchase. After 30 days, store credit only.",
    ),
    (
        "shipping",
        "Standard shipping takes 3 to 5 business days. Express shipping takes 1 to 2 and costs 12 dollars.",
    ),
    (
        "returns",
        "Items can be returned within 30 days if unused and in original packaging. Return shipping is free.",
    ),
    ("account", "A password reset link is sent to the email on file and expires after one hour."),
    (
        "data",
        "Customers can export all of their data from the account settings page. Exports arrive by email within 24 hours.",
    ),
    (
        "cancellation",
        "A subscription can be cancelled at any time and stays active until the end of the paid period.",
    ),
]

_ticket_numbers = itertools.count(1042)


def search_policies(query: str) -> str:
    """Search the company policy documents and return the matching sections."""

    terms = [t for t in query.lower().split() if len(t) > 2]
    hits = [
        f"[{topic}] {body}"
        for topic, body in POLICIES
        if any(t in topic or t in body.lower() for t in terms)
    ]
    return "\n".join(hits) if hits else "No policy matched that query."


def create_ticket(team: str, summary: str) -> str:
    """Open an internal ticket for a team and return its number."""

    number = next(_ticket_numbers)
    return f"Ticket #{number} opened for the {team} team: {summary}"


def send_email(to: str, body: str) -> str:
    """Send an email to the customer and confirm what went out."""

    return f"Sent to {to}: {body.strip()}"


def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression."""

    evaluator = SimpleEval(functions={}, names={})
    try:
        return str(evaluator.eval(expression))
    except Exception as exc:
        return f"calculator error: {exc}"


def make_read_file(root: Path) -> Callable[[str], str]:
    """A file reader confined to root, so a workflow cannot walk out of the
    workspace by asking for a parent directory."""

    def read_file(path: str) -> str:
        """Read a UTF-8 text file from the workspace directory."""

        resolved_root = root.resolve()
        target = (resolved_root / path).resolve()
        if not target.is_relative_to(resolved_root):
            return "read_file error: the path leaves the workspace directory."
        if not target.is_file():
            return f"read_file error: {path} is not a file in the workspace."
        return target.read_text(encoding="utf-8", errors="replace")[:20_000]

    return read_file


def registry(root: Path) -> dict[str, Callable[..., str]]:
    return {
        "search_policies": search_policies,
        "create_ticket": create_ticket,
        "send_email": send_email,
        "calculator": calculator,
        "read_file": make_read_file(root),
    }


def call(tool_id: str, arguments: dict[str, str], root: Path) -> str:
    fn = registry(root).get(tool_id)
    if fn is None:
        return f"unknown tool: {tool_id}"
    try:
        return fn(**arguments)
    except TypeError as exc:
        return f"{tool_id} error: {exc}"

from __future__ import annotations

import base64
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from orla.auth import OPEN_PATH
from orla.server import create_app
from orla.settings import settings

PASSWORD = "a shared secret"


def encode(text: str) -> str:
    return base64.b64encode(text.encode()).decode()


@pytest.fixture
def locked(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setattr(settings, "username", "orla")
    monkeypatch.setattr(settings, "password", PASSWORD)
    return TestClient(create_app(tmp_path / "workspace"))


@pytest.mark.parametrize(
    "header",
    [
        "",
        "Bearer something",
        "Basic not-base64!",
        f"Basic {encode('no colon in here')}",
        f"Basic {encode('orla:wrong')}",
        f"Basic {encode('someone:' + PASSWORD)}",
    ],
)
def test_anything_but_the_password_is_refused(locked: TestClient, header: str) -> None:
    response = locked.get("/api/health", headers={"authorization": header} if header else {})
    assert response.status_code == 401
    assert response.headers["www-authenticate"].startswith("Basic")


def test_the_password_is_let_through(locked: TestClient) -> None:
    assert locked.get("/api/health", auth=("orla", PASSWORD)).status_code == 200


def test_the_load_balancer_probe_needs_no_password(locked: TestClient) -> None:
    assert locked.get(OPEN_PATH).json() == {"ok": True}


def test_guessing_is_throttled_and_working_is_not(locked: TestClient) -> None:
    """Ten wrong passwords a minute is room for a typo and no room for a
    search. Getting it right is never counted, so nobody at work is stopped."""

    codes = [locked.get("/api/health", auth=("orla", "wrong")).status_code for _ in range(11)]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429
    assert locked.get("/api/health", auth=("orla", PASSWORD)).status_code == 200


def test_the_throttle_counts_each_caller_on_its_own(locked: TestClient) -> None:
    """Behind a load balancer every caller shares one peer address, so the
    forwarded client is what separates them."""

    for _ in range(11):
        locked.get("/api/health", auth=("orla", "wrong"), headers={"x-forwarded-for": "10.0.0.1"})
    blocked = locked.get(
        "/api/health", auth=("orla", "wrong"), headers={"x-forwarded-for": "10.0.0.1"}
    )
    other = locked.get(
        "/api/health", auth=("orla", "wrong"), headers={"x-forwarded-for": "10.0.0.2"}
    )
    assert (blocked.status_code, other.status_code) == (429, 401)


def test_a_password_outside_ascii_still_works(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """compare_digest raises on two non-ASCII strings, which would answer a
    login attempt with a 500 and lock everyone out of a deployment."""

    monkeypatch.setattr(settings, "password", "pässwörd")
    client = TestClient(create_app(tmp_path / "workspace"))
    assert client.get("/api/health", auth=("orla", "wröng")).status_code == 401
    assert client.get("/api/health", auth=("orla", "pässwörd")).status_code == 200


def test_no_password_leaves_the_door_open(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "password", "")
    client = TestClient(create_app(tmp_path / "workspace"))
    assert client.get("/api/health").status_code == 200

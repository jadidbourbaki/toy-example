from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from orla.budget import LEDGER, Ledger
from orla.models import DEFAULT_MODELS
from orla.server import create_app
from orla.settings import settings


class FakeRun:
    """What pydantic-ai hands back, as far as charging is concerned."""

    def __init__(self, input_tokens: int, output_tokens: int) -> None:
        self.usage = type(
            "Usage", (), {"input_tokens": input_tokens, "output_tokens": output_tokens}
        )()


def test_a_call_is_charged_at_the_registry_rate() -> None:
    ledger = Ledger()
    spec = DEFAULT_MODELS[0]
    usd, sent, back = ledger.charge(DEFAULT_MODELS, spec.id, FakeRun(1_000_000, 1_000_000))
    assert (sent, back) == (1_000_000, 1_000_000)
    assert usd == pytest.approx(spec.input_usd_per_mtok + spec.output_usd_per_mtok)
    assert ledger.spent_usd == pytest.approx(usd)


def test_the_cap_is_lifted_when_it_is_zero(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "spend_cap_usd", 0.0)
    ledger = Ledger()
    ledger.spent_usd = 1000.0
    assert ledger.refusal() is None


def test_the_cap_refuses_once_it_is_reached(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "spend_cap_usd", 1.0)
    ledger = Ledger()
    ledger.spent_usd = 0.99
    assert ledger.refusal() is None
    ledger.spent_usd = 1.0
    assert "$1.00 cap" in (ledger.refusal() or "")


@pytest.fixture
def spent(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    """A copy that has already spent its cap."""

    monkeypatch.setattr(settings, "spend_cap_usd", 5.0)
    client = TestClient(create_app(tmp_path / "workspace"))
    LEDGER.reset()
    LEDGER.spent_usd = 5.0
    yield client
    LEDGER.reset()


def bodies(graph: dict[str, Any]) -> list[tuple[str, dict[str, Any]]]:
    """Every endpoint that drives a model, with something valid to send it."""

    return [
        ("/api/compile", {"graph": graph}),
        ("/api/optimize", {"graph": graph}),
        ("/api/ask", {"graph": graph, "question": "hello", "history": []}),
        ("/api/sample", {"graph": graph, "count": 3}),
        ("/api/measure", {"graph": graph, "patches": [], "sample": ["a request"]}),
        ("/api/run", {"graph": graph, "request": "hello"}),
    ]


def test_every_model_endpoint_refuses_once_the_cap_is_spent(spent: TestClient) -> None:
    """A new endpoint that drives a model and forgets the ledger fails here
    rather than on someone's bill."""

    graph = spent.get("/api/graphs/customer_support").json()
    for path, body in bodies(graph):
        response = spent.post(path, json=body)
        assert "cap on model calls" in response.text, f"{path} spent money past the cap"


def test_what_costs_nothing_keeps_working(spent: TestClient) -> None:
    graph = spent.get("/api/graphs/customer_support").json()
    assert spent.post("/api/validate", json={"graph": graph}).status_code == 200
    assert (
        spent.post("/api/measure/plan", json={"graph": graph, "sample": ["a"]}).status_code == 200
    )
    assert spent.get("/api/graphs").status_code == 200

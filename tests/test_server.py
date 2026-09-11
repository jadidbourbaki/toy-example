"""HTTP surface tests. None of these reach a model. The compile and optimize
endpoints drive one, so they are exercised through their own units instead."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from orla.server import Wire, create_app, wire_schema


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
    return TestClient(create_app(tmp_path / "workspace"))


def test_health_reports_the_compiler_model(client: TestClient) -> None:
    body = client.get("/api/health").json()
    assert body["ok"] is True
    assert body["compiler_model"]


def test_graphs_are_listed_after_seeding(client: TestClient) -> None:
    ids = {row["id"] for row in client.get("/api/graphs").json()}
    assert ids == {"customer_support"}


def test_templates_are_served(client: TestClient) -> None:
    ids = [row["id"] for row in client.get("/api/templates").json()]
    assert ids == ["answer", "research_brief", "route", "review", "customer_support"]


def test_a_graph_reads_back(client: TestClient) -> None:
    body = client.get("/api/graphs/customer_support").json()
    assert body["id"] == "customer_support"
    assert len(body["nodes"]) == 8


def test_a_missing_graph_is_a_404(client: TestClient) -> None:
    assert client.get("/api/graphs/absent").status_code == 404


def test_a_graph_saves_and_reads_back(client: TestClient) -> None:
    graph = client.get("/api/graphs/customer_support").json()
    graph["description"] = "changed"
    assert client.put("/api/graphs/customer_support", json=graph).status_code == 200
    assert client.get("/api/graphs/customer_support").json()["description"] == "changed"


def test_a_mismatched_id_is_rejected(client: TestClient) -> None:
    graph = client.get("/api/graphs/customer_support").json()
    assert client.put("/api/graphs/other", json=graph).status_code == 400


def test_a_graph_deletes(client: TestClient) -> None:
    client.delete("/api/graphs/customer_support")
    assert client.get("/api/graphs").json() == []


def test_validate_returns_no_problems_and_a_price(client: TestClient) -> None:
    graph = client.get("/api/graphs/customer_support").json()
    body = client.post("/api/validate", json={"graph": graph}).json()
    assert body["problems"] == []
    assert body["estimate"]["usd"] > 0


def test_validate_reports_a_broken_reference(client: TestClient) -> None:
    graph = client.get("/api/graphs/customer_support").json()
    graph["edges"] = [e for e in graph["edges"] if e["id"] != "e3"]
    body = client.post("/api/validate", json={"graph": graph}).json()
    assert any("Draw the arrow" in p["message"] for p in body["problems"])


def test_patch_applies_and_reports_the_difference(client: TestClient) -> None:
    graph = client.get("/api/graphs/customer_support").json()
    patch = {
        "title": "cheaper",
        "rationale": "why",
        "op": "set_model",
        "node_id": "c4",
        "model": "glm-4.7-flash",
    }
    body = client.post("/api/patch", json={"graph": graph, "patches": [patch]}).json()
    assert body["diff"]["changed"] == ["c4"]
    assert (
        body["estimate"]["usd"]
        < client.post("/api/validate", json={"graph": graph}).json()["estimate"]["usd"]
    )


def test_models_read_and_write(client: TestClient) -> None:
    models = client.get("/api/models").json()
    models[0]["input_usd_per_mtok"] = 9.0
    assert client.put("/api/models", json=models).status_code == 200
    assert client.get("/api/models").json()[0]["input_usd_per_mtok"] == 9.0


def test_the_tool_catalog_is_served(client: TestClient) -> None:
    assert {row["id"] for row in client.get("/api/tools").json()} >= {
        "search_policies",
        "send_email",
    }


def test_the_schema_covers_every_wire_model(client: TestClient) -> None:
    definitions = client.get("/api/schema").json()["definitions"]
    for field in Wire.model_fields.values():
        assert field.annotation is not None
        assert field.annotation.__name__ in definitions


def test_every_serialized_field_is_required() -> None:
    """The server writes whole models, so a field with a default still arrives.
    Marking them required is what keeps the generated types free of optionals
    the client would have to guard."""

    for name, body in wire_schema()["definitions"].items():  # ty: ignore[not-iterable]
        assert isinstance(body, dict)
        if "properties" in body:
            assert set(body["required"]) == set(body["properties"]), name


def test_a_model_with_a_field_named_title_keeps_it() -> None:
    patch = wire_schema()["definitions"]["Patch"]  # ty: ignore[non-subscriptable]
    assert "title" in patch["properties"]


def test_an_answer_with_no_run_waiting_is_a_404(client: TestClient) -> None:
    response = client.post("/api/approve", json={"token": "stale", "decision": {"approved": True}})
    assert response.status_code == 404


def test_measure_plan_counts_runs_and_judgements(client: TestClient) -> None:
    graph = client.get("/api/graphs/customer_support").json()
    patch = {
        "title": "cheaper",
        "rationale": "why",
        "op": "set_model",
        "node_id": "c4",
        "model": "glm-4.7-flash",
    }
    body = client.post(
        "/api/measure/plan", json={"graph": graph, "patches": [patch], "sample": ["a", "b"]}
    ).json()
    assert body["graph_runs"] == 4
    assert body["judgements"] == 4
    assert body["projected_usd"] > 0


def test_measure_plan_falls_back_to_the_graphs_own_sample(client: TestClient) -> None:
    graph = client.get("/api/graphs/customer_support").json()
    assert len(graph["sample"]) == 3
    body = client.post("/api/measure/plan", json={"graph": graph, "patches": []}).json()
    assert body["sample_size"] == 3


def test_a_graphs_sample_survives_a_save(client: TestClient) -> None:
    graph = client.get("/api/graphs/customer_support").json()
    graph["sample"] = ["only this one"]
    client.put("/api/graphs/customer_support", json=graph)
    assert client.get("/api/graphs/customer_support").json()["sample"] == ["only this one"]

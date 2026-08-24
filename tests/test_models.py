from __future__ import annotations

import pytest

from orla.graph import AgentGraph
from orla.models import DEFAULT_MODELS, ModelSpec, build_model, by_id, capability_problems


def test_every_registry_id_is_unique() -> None:
    ids = [m.id for m in DEFAULT_MODELS]
    assert len(ids) == len(set(ids))


def test_every_entry_has_a_rate_and_a_prior() -> None:
    for model in DEFAULT_MODELS:
        assert model.input_usd_per_mtok > 0, model.id
        assert model.output_usd_per_mtok > 0, model.id
        assert 0 < model.quality_prior <= 1, model.id


def test_a_mantle_entry_builds_an_openai_client(models: list[ModelSpec]) -> None:
    spec = next(m for m in models if m.provider == "bedrock-mantle")
    built = build_model(spec)
    assert not isinstance(built, str)


def test_a_converse_entry_builds_a_bedrock_name(models: list[ModelSpec]) -> None:
    spec = next(m for m in models if m.provider == "bedrock-runtime")
    assert build_model(spec) == f"bedrock:{spec.model}"


def test_a_valid_graph_has_no_capability_problems(
    brief: AgentGraph, desk: AgentGraph, models: list[ModelSpec]
) -> None:
    assert capability_problems(brief, models) == []
    assert capability_problems(desk, models) == []


def toolless(models: list[ModelSpec]) -> ModelSpec:
    """A model that can neither call a tool nor return a typed result. Nothing
    in the registry is like this, so the check is exercised against one made
    for the test."""

    spec = models[0].model_copy(update={"id": "no-tools", "tools": False, "structured": False})
    models.append(spec)
    return spec


def test_a_react_stage_on_a_toolless_model_is_an_error(
    brief: AgentGraph, models: list[ModelSpec]
) -> None:
    toolless_spec = toolless(models)
    react = next(n for n in brief.nodes if n.config.kind == "react")
    react.config.model = toolless_spec.id  # ty: ignore[unresolved-attribute]
    problems = capability_problems(brief, models)
    assert len(problems) == 1
    assert "cannot call tools" in problems[0].message


def test_a_router_on_a_model_without_typed_output_is_an_error(
    desk: AgentGraph, models: list[ModelSpec]
) -> None:
    untyped = toolless(models)
    router = next(n for n in desk.nodes if n.config.kind == "router")
    router.config.model = untyped.id  # ty: ignore[unresolved-attribute]
    problems = capability_problems(desk, models)
    assert any("fixed set of labels" in p.message for p in problems)


def test_a_plain_call_on_a_toolless_model_is_fine(
    brief: AgentGraph, models: list[ModelSpec]
) -> None:
    plain = next(n for n in brief.nodes if n.config.kind == "llm")
    plain.config.model = toolless(models).id  # ty: ignore[unresolved-attribute]
    assert capability_problems(brief, models) == []


def test_a_model_outside_the_registry_is_an_error(
    brief: AgentGraph, models: list[ModelSpec]
) -> None:
    brief.nodes[1].config.model = "not-a-model"  # ty: ignore[unresolved-attribute]
    assert any("no model named" in p.message for p in capability_problems(brief, models))


@pytest.mark.parametrize("model", DEFAULT_MODELS, ids=lambda m: m.id)
def test_every_shipped_model_can_serve_any_stage(model: ModelSpec) -> None:
    """A model that cannot call a tool is unusable on a ReAct stage and a model
    that cannot return a typed result is unusable on a router. Shipping one
    would put a trap in the picker."""

    assert model.tools
    assert model.structured


def test_by_id_finds_nothing_for_an_unknown_name(models: list[ModelSpec]) -> None:
    assert by_id(models, "absent") is None


def test_a_model_builds_without_credentials(
    monkeypatch: pytest.MonkeyPatch, models: list[ModelSpec]
) -> None:
    """Building a model is not the moment to demand a key. A graph is edited,
    validated, and priced long before anything calls a provider, so a missing
    credential must not raise here."""

    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)
    for spec in models:
        assert build_model(spec) is not None

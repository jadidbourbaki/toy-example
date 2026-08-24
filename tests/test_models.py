from __future__ import annotations

import pytest

from sketch.graph import AgentGraph
from sketch.models import DEFAULT_MODELS, ModelSpec, build_model, by_id, capability_problems


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


def test_a_react_stage_on_a_toolless_model_is_an_error(
    brief: AgentGraph, models: list[ModelSpec]
) -> None:
    toolless = next(m for m in models if not m.tools)
    react = next(n for n in brief.nodes if n.config.kind == "react")
    react.config.model = toolless.id  # ty: ignore[unresolved-attribute]
    problems = capability_problems(brief, models)
    assert len(problems) == 1
    assert "cannot call tools" in problems[0].message


def test_a_router_on_a_model_without_typed_output_is_an_error(
    desk: AgentGraph, models: list[ModelSpec]
) -> None:
    untyped = next(m for m in models if not m.structured)
    router = next(n for n in desk.nodes if n.config.kind == "router")
    router.config.model = untyped.id  # ty: ignore[unresolved-attribute]
    problems = capability_problems(desk, models)
    assert any("fixed set of labels" in p.message for p in problems)


def test_a_plain_call_on_a_toolless_model_is_fine(
    brief: AgentGraph, models: list[ModelSpec]
) -> None:
    toolless = next(m for m in models if not m.tools)
    plain = next(n for n in brief.nodes if n.config.kind == "llm")
    plain.config.model = toolless.id  # ty: ignore[unresolved-attribute]
    assert capability_problems(brief, models) == []


def test_a_model_outside_the_registry_is_an_error(
    brief: AgentGraph, models: list[ModelSpec]
) -> None:
    brief.nodes[1].config.model = "not-a-model"  # ty: ignore[unresolved-attribute]
    assert any("no model named" in p.message for p in capability_problems(brief, models))


@pytest.mark.parametrize("model", DEFAULT_MODELS, ids=lambda m: m.id)
def test_a_toolless_model_is_also_untyped(model: ModelSpec) -> None:
    """Nothing in the registry calls tools while failing to return a typed
    result, so a single capability check would be enough today. Both flags
    exist because the next model added may split them."""

    if not model.tools:
        assert not model.structured


def test_by_id_finds_nothing_for_an_unknown_name(models: list[ModelSpec]) -> None:
    assert by_id(models, "absent") is None

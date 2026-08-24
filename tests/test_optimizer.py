from __future__ import annotations

from sketch.graph import AgentGraph, ReactConfig, validate_graph
from sketch.optimizer import Patch, apply_patch, apply_patches, diff


def patch(op: str, **fields: object) -> Patch:
    return Patch.model_validate({"title": op, "rationale": "because", "op": op, **fields})


def test_set_model_rebinds_one_node(brief: AgentGraph) -> None:
    updated = apply_patch(brief, patch("set_model", node_id="n4", model="opus"))
    assert updated.node("n4").config.model == "opus"  # ty: ignore[unresolved-attribute]
    assert brief.node("n4").config.model == "sonnet"  # ty: ignore[unresolved-attribute]


def test_set_max_iterations_never_drops_below_one(brief: AgentGraph) -> None:
    updated = apply_patch(brief, patch("set_max_iterations", node_id="n3", max_iterations=0))
    config = updated.node("n3").config
    assert isinstance(config, ReactConfig)
    assert config.max_iterations == 1


def test_set_instructions_leaves_a_node_without_them_alone(brief: AgentGraph) -> None:
    updated = apply_patch(brief, patch("set_instructions", node_id="n1", instructions="x"))
    assert updated.node("n1").config == brief.node("n1").config


def test_remove_node_reconnects_through_the_gap(brief: AgentGraph) -> None:
    updated = apply_patch(brief, patch("remove_node", node_id="n3"))
    assert updated.node("n3") is None
    assert any(e.source == "n2" and e.target == "n4" for e in updated.edges)
    assert not any("n3" in (e.source, e.target) for e in updated.edges)


def test_remove_node_keeps_the_graph_valid(brief: AgentGraph) -> None:
    updated = apply_patch(brief, patch("remove_node", node_id="n3"))
    errors = [p for p in validate_graph(updated) if p.severity == "error"]
    # The brief node still reads ${research}, which the removed node produced.
    assert all("research" in p.message for p in errors)


def test_insert_llm_after_lands_between_the_node_and_its_targets(brief: AgentGraph) -> None:
    updated = apply_patch(
        brief, patch("insert_llm_after", node_id="n3", name="review", stage="review", model="haiku")
    )
    added = next(n for n in updated.nodes if n.name == "review")
    assert any(e.source == "n3" and e.target == added.id for e in updated.edges)
    assert any(e.source == added.id and e.target == "n4" for e in updated.edges)
    assert not any(e.source == "n3" and e.target == "n4" for e in updated.edges)


def test_a_patch_naming_a_missing_node_changes_nothing(brief: AgentGraph) -> None:
    assert apply_patch(brief, patch("set_model", node_id="absent", model="opus")) == brief


def test_patches_apply_in_order(brief: AgentGraph) -> None:
    updated = apply_patches(
        brief,
        [
            patch("set_model", node_id="n4", model="opus"),
            patch("set_model", node_id="n4", model="haiku"),
        ],
    )
    assert updated.node("n4").config.model == "haiku"  # ty: ignore[unresolved-attribute]


def test_diff_reports_a_changed_node(brief: AgentGraph) -> None:
    updated = apply_patch(brief, patch("set_model", node_id="n4", model="opus"))
    assert diff(brief, updated) == {"added": [], "removed": [], "changed": ["n4"]}


def test_diff_reports_an_added_and_a_removed_node(brief: AgentGraph) -> None:
    removed = apply_patch(brief, patch("remove_node", node_id="n3"))
    assert diff(brief, removed)["removed"] == ["n3"]
    assert diff(removed, brief)["added"] == ["n3"]


def test_diff_ignores_a_node_that_only_moved(brief: AgentGraph) -> None:
    moved = brief.model_copy(deep=True)
    moved.node("n2").position.x += 400
    assert diff(brief, moved) == {"added": [], "removed": [], "changed": []}

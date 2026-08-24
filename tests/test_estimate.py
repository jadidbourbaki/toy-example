from __future__ import annotations

from sketch.estimate import count_tokens, estimate
from sketch.graph import AgentGraph
from sketch.models import ModelSpec
from tests.conftest import edge, graph_from, node

INPUT = {"kind": "input"}
OUTPUT = {"kind": "output"}


def test_count_tokens_uses_a_real_tokenizer() -> None:
    assert count_tokens("") == 0
    assert count_tokens("hello world") > 0
    assert count_tokens("hello world" * 50) > count_tokens("hello world")


def test_special_token_text_does_not_raise() -> None:
    assert count_tokens("<|endoftext|> is just text here") > 0


def test_a_graph_with_no_model_calls_costs_nothing() -> None:
    graph = graph_from(
        [
            node("a", "input", INPUT),
            node(
                "b",
                "count",
                {"kind": "tool", "tool": "word_count", "arguments": {"text": "${input}"}},
            ),
            node("c", "output", OUTPUT),
        ],
        [edge("e1", "a", "b"), edge("e2", "b", "c")],
    )
    priced = estimate(graph, [])
    assert priced.usd == 0.0
    assert priced.nodes == []


def test_a_cheaper_model_lowers_the_estimate(brief: AgentGraph, models: list[ModelSpec]) -> None:
    before = estimate(brief, models).usd
    for graph_node in brief.nodes:
        if hasattr(graph_node.config, "model"):
            graph_node.config.model = "haiku"  # ty: ignore[unresolved-attribute]
    assert estimate(brief, models).usd < before


def test_a_free_model_costs_nothing(brief: AgentGraph, models: list[ModelSpec]) -> None:
    for graph_node in brief.nodes:
        if hasattr(graph_node.config, "model"):
            graph_node.config.model = "local-qwen"  # ty: ignore[unresolved-attribute]
    assert estimate(brief, models).usd == 0.0


def test_a_longer_iteration_cap_costs_more(brief: AgentGraph, models: list[ModelSpec]) -> None:
    before = estimate(brief, models).usd
    react = next(n for n in brief.nodes if n.config.kind == "react")
    react.config.max_iterations = 12  # ty: ignore[unresolved-attribute]
    assert estimate(brief, models).usd > before


def test_a_router_branch_runs_a_share_of_the_time(
    desk: AgentGraph, models: list[ModelSpec]
) -> None:
    priced = estimate(desk, models)
    rows = {row.node_id: row for row in priced.nodes}
    assert rows["t2"].calls == 1.0
    assert rows["t3"].calls == 0.5


def test_a_model_the_registry_does_not_know_is_left_out(brief: AgentGraph) -> None:
    assert estimate(brief, []).nodes == []


def test_totals_are_the_sum_of_the_rows(brief: AgentGraph, models: list[ModelSpec]) -> None:
    priced = estimate(brief, models)
    assert priced.usd == round(sum(row.usd for row in priced.nodes), 6)
    assert priced.input_tokens == sum(row.input_tokens for row in priced.nodes)

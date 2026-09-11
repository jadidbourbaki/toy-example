from __future__ import annotations

import pytest

from orla.graph import (
    AgentGraph,
    branch_exclusive,
    find_cycle,
    references,
    render,
    topological_order,
    validate_graph,
)
from tests.conftest import edge, graph_from, node

INPUT = {"kind": "input"}
OUTPUT = {"kind": "output"}


def llm(stage: str = "answer", prompt: str = "${input}") -> dict:
    return {
        "kind": "llm",
        "stage": stage,
        "model": "haiku",
        "instructions": "Be brief.",
        "prompt": prompt,
    }


def test_topological_order_follows_dependencies(brief: AgentGraph) -> None:
    order = topological_order(brief)
    assert order is not None
    positions = {node_id: index for index, node_id in enumerate(order)}
    for e in brief.edges:
        assert positions[e.source] < positions[e.target]


def test_topological_order_is_stable_across_calls(brief: AgentGraph) -> None:
    assert topological_order(brief) == topological_order(brief)


def test_cycle_is_reported_with_the_names_on_it() -> None:
    graph = graph_from(
        [node("a", "one", llm()), node("b", "two", llm())],
        [edge("e1", "a", "b"), edge("e2", "b", "a")],
    )
    assert topological_order(graph) is None
    assert set(find_cycle(graph)) == {"one", "two"}


def test_acyclic_graph_reports_no_cycle(brief: AgentGraph) -> None:
    assert find_cycle(brief) == []


@pytest.mark.parametrize(
    ("template", "expected"),
    [
        ("${input}", {"input"}),
        ("Question: ${a}\n\nFindings: ${b}", {"a", "b"}),
        ("no references here", set()),
        ('{"json": "braces survive"}', set()),
        ("$$escaped", set()),
    ],
)
def test_references_finds_template_names(template: str, expected: set[str]) -> None:
    assert references(template) == expected


def test_render_leaves_unknown_references_in_place() -> None:
    assert render("${a} and ${b}", {"a": "one"}) == "one and ${b}"


def test_render_leaves_json_braces_alone() -> None:
    assert render('{"k": 1} ${a}', {"a": "x"}) == '{"k": 1} x'


def test_a_valid_graph_has_no_problems(brief: AgentGraph, support: AgentGraph) -> None:
    assert validate_graph(brief, {"research_brief"}) == []
    assert validate_graph(support, {"customer_support"}) == []


def test_a_reference_without_an_edge_is_an_error() -> None:
    graph = graph_from(
        [
            node("a", "input", INPUT),
            node("b", "one", llm()),
            node("c", "two", llm(prompt="${one}")),
            node("d", "output", OUTPUT),
        ],
        [edge("e1", "a", "b"), edge("e2", "a", "c"), edge("e3", "c", "d")],
    )
    messages = [p.message for p in validate_graph(graph) if p.severity == "error"]
    assert any("without an edge from one" in m for m in messages)


def test_a_name_that_is_not_an_identifier_is_an_error() -> None:
    graph = graph_from(
        [node("a", "input", INPUT), node("b", "two words", llm()), node("c", "output", OUTPUT)],
        [edge("e1", "a", "b"), edge("e2", "b", "c")],
    )
    assert any("not a usable name" in p.message for p in validate_graph(graph))


def test_duplicate_names_are_an_error() -> None:
    graph = graph_from(
        [
            node("a", "input", INPUT),
            node("b", "same", llm()),
            node("c", "same", llm()),
            node("d", "output", OUTPUT),
        ],
        [edge("e1", "a", "b"), edge("e2", "a", "c"), edge("e3", "b", "d")],
    )
    assert any("one name to mean one node" in p.message for p in validate_graph(graph))


@pytest.mark.parametrize(
    ("present", "missing"),
    [("input", "output"), ("output", "input")],
)
def test_a_graph_missing_a_boundary_is_an_error(present: str, missing: str) -> None:
    graph = graph_from([node("a", "only", {"kind": present})], [])
    messages = [p.message for p in validate_graph(graph)]
    assert any(f"exactly one {missing} node. Found 0" in m for m in messages)
    assert not any(f"exactly one {present} node" in m for m in messages)


def test_a_second_input_is_an_error() -> None:
    graph = graph_from(
        [node("a", "one", INPUT), node("b", "two", INPUT), node("c", "out", OUTPUT)],
        [edge("e1", "a", "c")],
    )
    assert any("exactly one input node. Found 2" in p.message for p in validate_graph(graph))


def test_a_subagent_calling_its_own_graph_is_an_error() -> None:
    graph = graph_from(
        [
            node("a", "input", INPUT),
            node("b", "child", {"kind": "subagent", "graph_id": "g", "prompt": "${input}"}),
            node("c", "output", OUTPUT),
        ],
        [edge("e1", "a", "b"), edge("e2", "b", "c")],
        graph_id="g",
    )
    assert any("calls its own graph" in p.message for p in validate_graph(graph))


def test_an_edge_label_that_is_not_a_route_is_an_error(support: AgentGraph) -> None:
    support.edges[1].label = "nonsense"
    messages = [p.message for p in validate_graph(support) if p.severity == "error"]
    assert any("not one of its routes" in m for m in messages)


def test_branch_exclusive_holds_out_the_join(support: AgentGraph) -> None:
    branches = branch_exclusive(support, "c2")
    assert branches["policy"] == {"c3", "c4", "c5", "c8", "c9"}
    assert branches["team"] == {"c6"}
    # output is reached by both branches, so neither branch may skip it.
    assert all("c7" not in nodes for nodes in branches.values())


def test_branch_exclusive_is_empty_for_a_node_that_does_not_route(brief: AgentGraph) -> None:
    assert branch_exclusive(brief, "n2") == {}

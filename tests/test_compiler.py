from __future__ import annotations

from pathlib import Path

import pytest

from orla.compiler import entry_name, resolve_network, stages_of, validate
from orla.graph import AgentGraph, Node, SubagentConfig

ENTRY = "async def research_brief_run(request: str) -> str:\n    return request\n"
STAGES = 'STAGES: dict[str, str] = {"clarify": "haiku", "research": "sonnet", "answer": "sonnet"}\n'
MODEL_FOR = "def model_for(stage: str) -> str:\n    return STAGES[stage]\n"


def good_module() -> str:
    return f"{STAGES}\n{MODEL_FOR}\n{ENTRY}"


@pytest.mark.parametrize(
    ("graph_id", "expected"),
    [("brief", "brief_run"), ("research-brief", "research_brief_run"), ("7x", "g_7x_run")],
)
def test_entry_name_is_always_an_identifier(graph_id: str, expected: str) -> None:
    assert entry_name(graph_id) == expected


def test_stages_of_collects_every_bound_stage(brief: AgentGraph) -> None:
    bound = stages_of(brief)
    assert set(bound) == {"clarify", "research", "answer"}
    assert all(model for model in bound.values())


def test_resolve_network_puts_dependencies_first(support: AgentGraph, brief: AgentGraph) -> None:
    caller = support.model_copy(deep=True)
    caller.id = "front_desk"
    caller.nodes.append(
        Node(
            id="s1",
            name="deep",
            config=SubagentConfig(graph_id="research_brief", prompt="${input}"),
        )
    )
    network = resolve_network(caller, [brief])
    assert [g.id for g in network] == ["research_brief", "front_desk"]


def test_resolve_network_of_a_lone_graph_is_itself(brief: AgentGraph) -> None:
    assert [g.id for g in resolve_network(brief, [])] == ["research_brief"]


def test_a_good_module_passes(brief: AgentGraph) -> None:
    assert validate(good_module(), brief, [brief]) == []


def test_source_that_does_not_parse_is_rejected(brief: AgentGraph) -> None:
    problems = validate("def broken(:", brief, [brief])
    assert len(problems) == 1
    assert "does not parse" in problems[0]


def test_an_unused_import_is_rejected(brief: AgentGraph) -> None:
    problems = validate(f"import os\n{good_module()}", brief, [brief])
    assert any("F401" in p for p in problems)


def test_an_undefined_name_is_rejected(brief: AgentGraph) -> None:
    problems = validate(f"{good_module()}\nvalue = missing_name\n", brief, [brief])
    assert any("F821" in p for p in problems)


def test_a_missing_entry_function_is_rejected(brief: AgentGraph) -> None:
    problems = validate(f"{STAGES}\n{MODEL_FOR}", brief, [brief])
    assert any("research_brief_run" in p for p in problems)


def test_a_missing_stages_table_is_rejected(brief: AgentGraph) -> None:
    problems = validate(f"{MODEL_FOR.replace('STAGES[stage]', 'stage')}\n{ENTRY}", brief, [brief])
    assert any("STAGES dict" in p for p in problems)


def test_a_stage_absent_from_the_table_is_rejected(brief: AgentGraph) -> None:
    partial = 'STAGES: dict[str, str] = {"clarify": "haiku"}\n'
    problems = validate(f"{partial}\n{MODEL_FOR}\n{ENTRY}", brief, [brief])
    assert any("'research'" in p for p in problems)
    assert any("'answer'" in p for p in problems)


def test_a_missing_model_for_is_rejected(brief: AgentGraph) -> None:
    problems = validate(f"{STAGES}\n{ENTRY}", brief, [brief])
    assert any("model_for" in p for p in problems)


def test_every_graph_in_a_network_needs_its_entry(support: AgentGraph, brief: AgentGraph) -> None:
    caller = support.model_copy(deep=True)
    caller.id = "front_desk"
    caller.nodes.append(
        Node(
            id="s1",
            name="deep",
            config=SubagentConfig(graph_id="research_brief", prompt="${input}"),
        )
    )
    network = resolve_network(caller, [brief])
    problems = validate(good_module(), caller, network)
    assert any("front_desk_run" in p for p in problems)
    assert not any("research_brief_run" in p for p in problems)


def test_the_worked_example_satisfies_the_validator(support: AgentGraph) -> None:
    """The example in the compiler prompt has to pass the checks the compiler
    applies, or it teaches the model to produce rejected source."""

    source = (Path("orla/prompts/example_module.py")).read_text(encoding="utf-8")
    assert validate(source, support, [support]) == []

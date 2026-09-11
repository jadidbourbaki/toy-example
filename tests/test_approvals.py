from __future__ import annotations

import asyncio
from pathlib import Path

from orla.approvals import Approvals, Decision
from orla.graph import (
    AgentGraph,
    ApproveConfig,
    Edge,
    InputConfig,
    LLMConfig,
    Node,
    OutputConfig,
    ToolConfig,
    answering_stage,
    validate_graph,
)
from orla.models import ModelSpec
from orla.runner import RunEvent, run_graph


def gated(tool: str = "search_policies") -> AgentGraph:
    """input -> tool -> approve -> output. Nothing in it calls a model, so a
    run exercises the approve stage and nothing else."""

    return AgentGraph(
        id="gated",
        name="Gated",
        nodes=[
            Node(id="a", name="input", config=InputConfig()),
            Node(
                id="b", name="lookup", config=ToolConfig(tool=tool, arguments={"query": "${input}"})
            ),
            Node(id="c", name="approve", config=ApproveConfig(question="Send?")),
            Node(id="d", name="output", config=OutputConfig()),
        ],
        edges=[
            Edge(id="1", source="a", target="b"),
            Edge(id="2", source="b", target="c"),
            Edge(id="3", source="c", target="d"),
        ],
    )


async def collect(
    graph: AgentGraph, models: list[ModelSpec], tmp_path: Path, approvals: Approvals | None
) -> list[RunEvent]:
    return [e async for e in run_graph(graph, "refund", models, tmp_path, [], approvals)]


def test_a_registry_hands_a_decision_to_whoever_waits() -> None:
    async def go() -> Decision:
        approvals = Approvals()
        token = approvals.open()
        assert approvals.answer(token, Decision(approved=False, note="shorter"))
        assert not approvals.answer("stale", Decision())
        return await approvals.wait(token, timeout=1)

    assert asyncio.run(go()) == Decision(approved=False, note="shorter")


def test_silence_is_a_no() -> None:
    async def go() -> Decision:
        approvals = Approvals()
        return await approvals.wait(approvals.open(), timeout=0.01)

    assert asyncio.run(go()).approved is False


def test_without_a_registry_an_approve_stage_lets_everything_through(
    models: list[ModelSpec], tmp_path: Path
) -> None:
    events = asyncio.run(collect(gated(), models, tmp_path, None))
    approve = next(e for e in events if e.type == "node_done" and e.name == "approve")
    assert approve.route == "approved automatically"
    assert "refund" in events[-1].text.lower()


def test_an_approved_run_carries_on(models: list[ModelSpec], tmp_path: Path) -> None:
    async def go() -> list[RunEvent]:
        approvals = Approvals()
        seen: list[RunEvent] = []
        async for event in run_graph(gated(), "refund", models, tmp_path, [], approvals):
            seen.append(event)
            if event.type == "approval":
                assert event.text
                approvals.answer(event.token, Decision(approved=True))
        return seen

    events = asyncio.run(go())
    assert [e.type for e in events if e.type in ("approval", "run_done")] == [
        "approval",
        "run_done",
    ]
    assert (
        next(e for e in events if e.name == "approve" and e.type == "node_done").route == "approved"
    )


def test_a_declined_run_skips_everything_after_the_gate(
    models: list[ModelSpec], tmp_path: Path
) -> None:
    async def go() -> list[RunEvent]:
        approvals = Approvals()
        seen: list[RunEvent] = []
        async for event in run_graph(gated(), "refund", models, tmp_path, [], approvals):
            seen.append(event)
            if event.type == "approval":
                approvals.answer(event.token, Decision(approved=False))
        return seen

    events = asyncio.run(go())
    skipped = [e.name for e in events if e.type == "node_skipped"]
    assert skipped == ["output"]
    assert events[-1].text.startswith("Declined at approve")


def test_an_approve_stage_needs_one_feeder() -> None:
    graph = gated()
    graph.edges = [e for e in graph.edges if e.target != "c"]
    messages = [
        p.message for p in validate_graph(graph) if p.node_id == "c" and p.severity == "error"
    ]
    assert any("exactly one stage" in m for m in messages)


def test_the_answering_stage_is_found_through_a_judge(support: AgentGraph) -> None:
    approve = next(n for n in support.nodes if n.config.kind == "approve")
    answering = answering_stage(support, approve.id)
    assert answering is not None
    assert isinstance(answering.config, LLMConfig)
    assert answering.name == "reply"

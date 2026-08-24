"""Propose changes to a graph and price each one.

A model reads the graph and returns patches drawn from a closed set of
operations. A closed set is what makes each patch independently
applicable, so the canvas can accept one and reject the next.

Every patch is priced by applying it alone to the base graph and
re-estimating, so the number beside a proposal is computed here rather
than claimed by the model.
"""

from __future__ import annotations

import uuid
from typing import Literal

from deepdiff import DeepDiff
from pydantic import BaseModel, Field
from pydantic_ai import Agent

from orla.estimate import estimate
from orla.graph import (
    AgentGraph,
    Edge,
    LLMConfig,
    Node,
    Position,
    ReactConfig,
    RouterConfig,
    SubagentConfig,
    validate_graph,
)
from orla.models import TOOL_CATALOG, ModelSpec, driver_model
from orla.settings import settings

Operation = Literal[
    "set_model",
    "set_stage",
    "set_instructions",
    "set_prompt",
    "set_max_iterations",
    "remove_node",
    "insert_llm_after",
]


class Patch(BaseModel):
    """One proposed change. node_id names the node the operation acts
    on, and the fields a given operation reads are the only ones it
    needs."""

    id: str = Field(default_factory=lambda: uuid.uuid4().hex[:8])
    title: str = Field(
        description="A short imperative summary, for example 'Serve clarify with the cheapest model'."
    )
    rationale: str = Field(description="Two sentences at most on why the change helps.")
    op: Operation
    node_id: str = ""
    model: str = ""
    stage: str = ""
    instructions: str = ""
    prompt: str = ""
    max_iterations: int = 0
    name: str = Field(default="", description="For insert_llm_after, the new node's name.")


class Proposal(BaseModel):
    summary: str = Field(
        description="Two sentences on the shape of the problem and what to do about it."
    )
    patches: list[Patch] = Field(default_factory=list)


class PricedPatch(BaseModel):
    patch: Patch
    usd_delta: float
    applies: bool
    problems: list[str] = Field(default_factory=list)


class OptimizeResult(BaseModel):
    summary: str
    baseline_usd: float
    patches: list[PricedPatch] = Field(default_factory=list)
    ok: bool = True
    error: str = ""


def apply_patch(graph: AgentGraph, patch: Patch) -> AgentGraph:
    """The graph with one patch applied. The input is left untouched."""

    updated = graph.model_copy(deep=True)
    node = updated.node(patch.node_id)

    if patch.op == "remove_node":
        if node is None:
            return updated
        sources = [e.source for e in updated.incoming(node.id)]
        targets = [(e.target, e.label) for e in updated.outgoing(node.id)]
        updated.edges = [e for e in updated.edges if node.id not in (e.source, e.target)]
        for source in sources:
            for target, label in targets:
                if source != target:
                    updated.edges.append(
                        Edge(
                            id=f"e{uuid.uuid4().hex[:8]}", source=source, target=target, label=label
                        )
                    )
        updated.nodes = [n for n in updated.nodes if n.id != node.id]
        return updated

    if patch.op == "insert_llm_after":
        if node is None:
            return updated
        new_id = f"n{uuid.uuid4().hex[:8]}"
        new_node = Node(
            id=new_id,
            name=patch.name or f"stage_{new_id[:4]}",
            position=Position(x=node.position.x + 220, y=node.position.y + 90),
            config=LLMConfig(
                stage=patch.stage or "review",
                model=patch.model,
                instructions=patch.instructions
                or "Check the input and correct anything wrong with it.",
                prompt=patch.prompt or f"${{{node.name}}}",
            ),
        )
        for edge in updated.outgoing(node.id):
            edge.source = new_id
        updated.nodes.append(new_node)
        updated.edges.append(
            Edge(id=f"e{uuid.uuid4().hex[:8]}", source=node.id, target=new_id, label="")
        )
        return updated

    if node is None:
        return updated

    config = node.config
    bindable = (LLMConfig, ReactConfig, RouterConfig)
    promptable = (LLMConfig, ReactConfig, RouterConfig, SubagentConfig)

    if patch.op == "set_model" and isinstance(config, bindable):
        config.model = patch.model
    elif patch.op == "set_stage" and isinstance(config, bindable):
        config.stage = patch.stage
    elif patch.op == "set_instructions" and isinstance(config, LLMConfig | ReactConfig):
        config.instructions = patch.instructions
    elif patch.op == "set_prompt" and isinstance(config, promptable):
        config.prompt = patch.prompt
    elif patch.op == "set_max_iterations" and isinstance(config, ReactConfig):
        config.max_iterations = max(1, patch.max_iterations)

    return updated


def apply_patches(graph: AgentGraph, patches: list[Patch]) -> AgentGraph:
    """The graph with every patch applied in order."""

    current = graph
    for patch in patches:
        current = apply_patch(current, patch)
    return current


def diff(before: AgentGraph, after: AgentGraph) -> dict[str, list[str]]:
    """What changed between two graphs, grouped for the canvas: nodes
    added, removed, and changed."""

    before_nodes = {n.id: n for n in before.nodes}
    after_nodes = {n.id: n for n in after.nodes}

    added = sorted(set(after_nodes) - set(before_nodes))
    removed = sorted(set(before_nodes) - set(after_nodes))
    changed = [
        node_id
        for node_id in sorted(set(before_nodes) & set(after_nodes))
        if DeepDiff(
            before_nodes[node_id].model_dump(exclude={"position"}),
            after_nodes[node_id].model_dump(exclude={"position"}),
            ignore_order=True,
        )
    ]
    return {"added": added, "removed": removed, "changed": changed}


def _catalog(models: list[ModelSpec]) -> str:
    rows = [
        f"- {m.id}: {m.label or m.model}, quality prior {m.quality_prior}, "
        f"${m.input_usd_per_mtok}/Mtok in and ${m.output_usd_per_mtok}/Mtok out"
        for m in models
    ]
    tools = [f"- {t.id}: {t.description}" for t in TOOL_CATALOG]
    return "## Models\n\n" + "\n".join(rows) + "\n\n## Tools\n\n" + "\n".join(tools)


INSTRUCTIONS = """
You review an agent graph and propose changes that make it cheaper, faster, or
more reliable without giving up the result the graph is for.

Return patches drawn from this closed set of operations:

- `set_model` moves a stage onto a different model. Moving a mechanical stage
  down to a cheaper model is the highest yield change in most graphs. Moving a
  stage up is right when the stage carries the quality of the whole answer.
- `set_stage` renames the stage a node serves, which matters when two nodes do
  the same kind of work and should share one binding.
- `set_instructions` and `set_prompt` rewrite a node's text. Use them to cut a
  vague instruction down to a specific one, or to constrain an output format so
  the stage stops paying for tokens nobody reads.
- `set_max_iterations` caps a ReAct loop. A loop that rarely needs six turns is
  paying for six.
- `remove_node` deletes a stage whose work another stage already does. Its
  predecessors reconnect to its successors.
- `insert_llm_after` adds a stage after an existing one. Use it for a
  validation step after a tool call, or a cheap filter in front of an expensive
  stage.

Rules for a good proposal:

- Between three and six patches. A long list nobody reads is worse than three
  that land.
- Every patch stands on its own. Someone accepts the second and rejects the
  first, so a patch must never depend on another patch having been applied.
- Name a real mechanism in the rationale. "Cheaper model" is not a reason.
  "The clarify stage rewrites one sentence, which the small model does as well
  as the large one at a fifth of the price" is a reason.
- Output tokens usually dominate a bill. A change to an output format is often
  worth more than a change to a prompt.
- Leave the stage that carries the answer alone unless you have a specific
  reason to touch it.
- Do not propose a change the graph already has.
"""


async def optimize(graph: AgentGraph, models: list[ModelSpec]) -> OptimizeResult:
    """Ask for proposals, then price each one by applying it alone."""

    baseline = estimate(graph, models).usd

    if not settings.has_model_credentials:
        return OptimizeResult(
            summary="",
            baseline_usd=baseline,
            ok=False,
            error="Set AWS_BEARER_TOKEN_BEDROCK to run the optimizer. It drives a model.",
        )

    agent = Agent[None, Proposal](
        driver_model(settings.compiler_model),
        output_type=Proposal,
        instructions=INSTRUCTIONS,
        model_settings={"max_tokens": 8192},
    )

    prompt = (
        f"{_catalog(models)}\n\n## The graph\n\n```json\n{graph.model_dump_json(indent=2)}\n```\n\n"
        f"The static estimate for one request through the graph is ${baseline:.6f}."
    )

    run = await agent.run(prompt)
    proposal = run.output

    priced: list[PricedPatch] = []
    known = {m.id for m in models}
    for patch in proposal.patches:
        problems: list[str] = []
        if patch.node_id and graph.node(patch.node_id) is None:
            problems.append(f"The graph has no node with id {patch.node_id!r}.")
        if patch.op == "set_model" and patch.model not in known:
            problems.append(f"The registry has no model named {patch.model!r}.")

        candidate = apply_patch(graph, patch)
        problems.extend(p.message for p in validate_graph(candidate) if p.severity == "error")

        priced.append(
            PricedPatch(
                patch=patch,
                usd_delta=round(estimate(candidate, models).usd - baseline, 6),
                applies=not problems,
                problems=problems,
            )
        )

    return OptimizeResult(summary=proposal.summary, baseline_usd=baseline, patches=priced)

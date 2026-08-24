"""Execute an agent graph and report what each stage did.

The runner walks the graph itself rather than executing generated
source. The graph stays the source of truth, the canvas gets an event
per stage while a run is in flight, and a run costs nothing beyond the
model calls the graph actually asks for.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.usage import UsageLimits
from pydantic_deep import BASE_PROMPT, create_deep_agent, create_default_deps

from sketch import tools
from sketch.graph import (
    AgentGraph,
    LLMConfig,
    ReactConfig,
    RouterConfig,
    SubagentConfig,
    ToolConfig,
    branch_exclusive,
    render,
    topological_order,
)
from sketch.models import ModelSpec, build_model, by_id

EventType = Literal["run_start", "node_start", "node_done", "node_skipped", "run_done", "run_error"]

# request_limit raises rather than stopping the loop, so a cap set exactly at
# the tool budget turns a stage that wanted one more turn into a failed run.
# The budget goes in the instructions, where the model can plan around it, and
# request_limit sits above it as a backstop for a loop that has run away.
BACKSTOP = 2


def tool_budget(max_iterations: int) -> str:
    return (
        f"You may call tools at most {max_iterations} times. Answer as soon as you "
        f"have enough to answer with, and answer from what you have once the "
        f"budget is spent."
    )


class RunEvent(BaseModel):
    """One thing that happened during a run. The canvas lights a node on
    node_start and fills it in on node_done."""

    type: EventType
    node_id: str = ""
    name: str = ""
    kind: str = ""
    stage: str = ""
    model: str = ""
    text: str = ""
    route: str = ""
    ms: int = 0
    usd: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    depth: int = 0
    graph_id: str = ""


class RunTotals(BaseModel):
    usd: float = 0.0
    input_tokens: int = 0
    output_tokens: int = 0
    ms: int = 0
    nodes_run: int = 0
    nodes_skipped: int = 0


class Runner:
    def __init__(
        self, models: list[ModelSpec], workspace_root: Path, graphs: list[AgentGraph]
    ) -> None:
        self.models = models
        self.workspace_root = workspace_root
        self.graphs = {g.id: g for g in graphs}
        self.totals = RunTotals()
        self._deps = create_default_deps()

    def _model(self, model_id: str) -> Any:
        spec = by_id(self.models, model_id)
        if spec is None:
            raise ValueError(f"The model registry has no entry named {model_id!r}.")
        return build_model(spec)

    def _charge(self, model_id: str, result: Any) -> tuple[float, int, int]:
        # pydantic-ai exposes run usage as a property on current versions and as
        # a method on older ones. Accept either so a version bump does not
        # silently stop charging a run.
        usage = result.usage
        if callable(usage):
            usage = usage()
        spec = by_id(self.models, model_id)
        input_tokens = int(getattr(usage, "input_tokens", 0) or 0)
        output_tokens = int(getattr(usage, "output_tokens", 0) or 0)
        usd = 0.0
        if spec is not None:
            usd = (
                input_tokens * spec.input_usd_per_mtok + output_tokens * spec.output_usd_per_mtok
            ) / 1_000_000
        self.totals.usd += usd
        self.totals.input_tokens += input_tokens
        self.totals.output_tokens += output_tokens
        return round(usd, 6), input_tokens, output_tokens

    def _tool_functions(self, names: list[str]) -> list[Any]:
        registry = tools.registry(self.workspace_root)
        return [registry[name] for name in names if name in registry]

    async def run(self, graph: AgentGraph, request: str, depth: int = 0) -> AsyncIterator[RunEvent]:
        order = topological_order(graph)
        if order is None:
            yield RunEvent(
                type="run_error",
                graph_id=graph.id,
                depth=depth,
                text="The graph has a cycle, so it has no execution order.",
            )
            return

        yield RunEvent(
            type="run_start", graph_id=graph.id, name=graph.name, depth=depth, text=request
        )

        values: dict[str, Any] = {}
        skipped: set[str] = set()

        for node_id in order:
            node = graph.node(node_id)
            if node is None:
                continue

            config = node.config
            stage = getattr(config, "stage", "")
            model_id = getattr(config, "model", "")

            if node_id in skipped:
                self.totals.nodes_skipped += 1
                yield RunEvent(
                    type="node_skipped",
                    node_id=node.id,
                    name=node.name,
                    kind=config.kind,
                    graph_id=graph.id,
                    depth=depth,
                    text="A router took a different branch.",
                )
                continue

            if config.kind == "input":
                values[node.name] = request
                yield RunEvent(
                    type="node_done",
                    node_id=node.id,
                    name=node.name,
                    kind="input",
                    graph_id=graph.id,
                    depth=depth,
                    text=request,
                )
                continue

            yield RunEvent(
                type="node_start",
                node_id=node.id,
                name=node.name,
                kind=config.kind,
                stage=stage,
                model=model_id,
                graph_id=graph.id,
                depth=depth,
            )

            started = time.monotonic()
            usd = 0.0
            input_tokens = 0
            output_tokens = 0
            route = ""

            try:
                if config.kind == "output":
                    sources = [graph.node(e.source) for e in graph.incoming(node.id)]
                    parts = [str(values.get(s.name, "")) for s in sources if s]
                    text = "\n\n".join(p for p in parts if p) or request

                elif isinstance(config, ToolConfig):
                    arguments = {k: render(v, values) for k, v in config.arguments.items()}
                    text = tools.call(config.tool, arguments, self.workspace_root)

                elif isinstance(config, SubagentConfig):
                    child = self.graphs.get(config.graph_id)
                    if child is None:
                        raise ValueError(f"{node.name} calls a graph that is not in the workspace.")
                    child_request = render(config.prompt, values)
                    text = ""
                    async for event in self.run(child, child_request, depth + 1):
                        if event.type == "run_done":
                            text = event.text
                        yield event

                elif isinstance(config, RouterConfig):
                    labels = [r.label for r in config.routes]
                    described = "\n".join(f"- {r.label}: {r.description}" for r in config.routes)
                    agent: Agent[None, str] = Agent(
                        self._model(model_id),
                        output_type=Literal[tuple(labels)],  # ty: ignore[invalid-type-form]
                        instructions=f"{config.question}\n\nAnswer with exactly one label.\n\n{described}",
                    )
                    result = await agent.run(render(config.prompt, values))
                    route = str(result.output)
                    text = route
                    usd, input_tokens, output_tokens = self._charge(model_id, result)
                    for label, branch in branch_exclusive(graph, node.id).items():
                        if label != route:
                            skipped |= branch

                elif isinstance(config, ReactConfig):
                    agent_deep = create_deep_agent(
                        model=self._model(model_id),
                        instructions=f"{BASE_PROMPT}\n\n{config.instructions}\n\n{tool_budget(config.max_iterations)}",
                        tools=self._tool_functions(config.tools),
                        web_search=False,
                        web_fetch=False,
                        thinking=False,
                        include_todo=False,
                        include_filesystem=False,
                        include_execute=False,
                        include_subagents=False,
                        include_skills=False,
                        include_builtin_subagents=False,
                        include_plan=False,
                        include_memory=False,
                    )
                    result = await agent_deep.run(
                        render(config.prompt, values),
                        deps=self._deps,
                        usage_limits=UsageLimits(request_limit=config.max_iterations + BACKSTOP),
                    )
                    text = str(result.output)
                    usd, input_tokens, output_tokens = self._charge(model_id, result)

                elif isinstance(config, LLMConfig):
                    plain: Agent[None, str] = Agent(
                        self._model(model_id), instructions=config.instructions
                    )
                    result = await plain.run(render(config.prompt, values))
                    text = str(result.output)
                    usd, input_tokens, output_tokens = self._charge(model_id, result)

                else:
                    text = ""

            except Exception as exc:
                yield RunEvent(
                    type="run_error",
                    node_id=node.id,
                    name=node.name,
                    kind=config.kind,
                    graph_id=graph.id,
                    depth=depth,
                    ms=int((time.monotonic() - started) * 1000),
                    text=f"{type(exc).__name__}: {exc}",
                )
                return

            values[node.name] = text
            self.totals.nodes_run += 1
            elapsed = int((time.monotonic() - started) * 1000)
            self.totals.ms += elapsed

            yield RunEvent(
                type="node_done",
                node_id=node.id,
                name=node.name,
                kind=config.kind,
                stage=stage,
                model=model_id,
                graph_id=graph.id,
                depth=depth,
                text=text,
                route=route,
                ms=elapsed,
                usd=usd,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
            )

        final = next((n for n in graph.nodes if n.config.kind == "output"), None)
        answer = str(values.get(final.name, "")) if final else ""
        yield RunEvent(
            type="run_done",
            graph_id=graph.id,
            name=graph.name,
            depth=depth,
            text=answer,
            usd=round(self.totals.usd, 6),
            input_tokens=self.totals.input_tokens,
            output_tokens=self.totals.output_tokens,
            ms=self.totals.ms,
        )


async def run_graph(
    graph: AgentGraph,
    request: str,
    models: list[ModelSpec],
    workspace_root: Path,
    graphs: list[AgentGraph] | None = None,
) -> AsyncIterator[RunEvent]:
    runner = Runner(models, workspace_root, graphs or [])
    async for event in runner.run(graph, request):
        yield event

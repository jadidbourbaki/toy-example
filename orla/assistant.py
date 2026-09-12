"""The assistant that answers questions about the open graph.

It reads. It does not edit. A helper that quietly rewrites the canvas is
hard to trust, and the optimizer already exists for changing a graph on
purpose. What this one has is tools: the graph, the estimate for each
stage, the model registry, the validator, and a way to price a binding it
has not been given. It is the same pydantic-deep harness an Agent stage on
the canvas runs on, with everything the harness adds by default switched
off, so the assistant is an instance of the thing it explains.

The tools close over the graph the question was asked about, so each
question is answered against the graph as it stands now, and an edit
between two questions is picked up without the history carrying a stale
copy of it.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Callable
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import AgentRunResultEvent
from pydantic_ai.messages import (
    ModelMessage,
    ModelMessagesTypeAdapter,
    PartDeltaEvent,
    PartStartEvent,
    TextPart,
    TextPartDelta,
)
from pydantic_ai.usage import UsageLimits
from pydantic_deep import BASE_PROMPT, create_deep_agent, create_default_deps

from orla.budget import LEDGER
from orla.estimate import estimate
from orla.graph import (
    AgentGraph,
    JudgeConfig,
    LLMConfig,
    ReactConfig,
    RouterConfig,
    validate_graph,
)
from orla.models import DEFAULT_MODELS, ModelSpec, by_id, capability_problems, driver_model
from orla.settings import settings

BOUND = (LLMConfig, ReactConfig, RouterConfig, JudgeConfig)

INSTRUCTIONS = """
You are the assistant inside a workflow builder, talking with the person
building the workflow open in front of them. Answer the way a helpful
colleague would. A greeting gets a greeting and a one line offer of what you
can help with. Never describe the message you were sent.

Use the tools before answering anything about the workflow, its cost, or
its models. Name the stages and the models involved rather than talking in
general terms, and give the number when there is one. Before calling one
model cheaper or dearer than another, read both rates from the registry and
quote both. To say what a change would cost, price it with the tool rather
than estimating in your head.

When someone asks how to change the workflow, say what to change and where.
You cannot edit the canvas, so do not offer to. Two or three sentences is
the right length, and lists are welcome when there are several items. Use
no em-dashes.
"""

TOOL_CALLS = 6


class AskRequest(BaseModel):
    graph: AgentGraph
    question: str
    # pydantic-ai's own message history, round-tripped through the client so
    # the conversation keeps its shape without this module inventing one.
    history: list[Any] = Field(default_factory=list)


def tools_for(
    graph: AgentGraph, models: list[ModelSpec], known: set[str]
) -> list[Callable[..., str]]:
    """Read-only tools closed over one graph."""

    def workflow() -> str:
        """The workflow as JSON: its stages, what feeds what, and each stage's settings."""

        return graph.model_dump_json(indent=2)

    def stage_costs() -> str:
        """What each stage is estimated to cost per request, and the total."""

        priced = estimate(graph, models)
        rows = "\n".join(
            f"- {row.name}: {row.model}, about ${row.usd:.6f} per request, "
            f"{row.input_tokens} input and {row.output_tokens} output tokens"
            for row in priced.nodes
        )
        return (
            f"{rows or 'No stage makes a model call yet.'}\n\nTotal: ${priced.usd:.6f} per request."
        )

    def model_registry() -> str:
        """Every model a stage can be bound to, with its rates per million tokens."""

        return "\n".join(
            f"- {m.id}: {m.label}, ${m.input_usd_per_mtok} in and ${m.output_usd_per_mtok} out, "
            f"tools {'yes' if m.tools else 'no'}, typed answers {'yes' if m.structured else 'no'}"
            for m in models
        )

    def problems() -> str:
        """What the validator says about the workflow as it stands."""

        found = validate_graph(graph, known) + capability_problems(graph, models)
        return "\n".join(f"- {p.severity}: {p.message}" for p in found) or "None."

    def price_with(stage_name: str, model_id: str) -> str:
        """What the workflow would cost per request with one stage bound to another model."""

        changed = graph.model_copy(deep=True)
        target = next((n for n in changed.nodes if n.name == stage_name), None)
        if target is None or not isinstance(target.config, BOUND):
            return f"No stage named {stage_name!r} takes a model."
        if by_id(models, model_id) is None:
            return f"The registry has no model named {model_id!r}."
        target.config.model = model_id
        before = estimate(graph, models).usd
        after = estimate(changed, models).usd
        return (
            f"${before:.6f} per request now, ${after:.6f} with {stage_name} on {model_id}, "
            f"a change of ${after - before:+.6f}."
        )

    return [workflow, stage_costs, model_registry, problems, price_with]


async def ask(
    request: AskRequest, models: list[ModelSpec], known: set[str]
) -> AsyncIterator[tuple[str, str]]:
    """Stream an answer as (event, data) pairs. Text arrives in deltas so the
    panel fills as it goes, and the closing event carries the history the next
    question should be asked with."""

    if not settings.has_model_credentials:
        yield (
            "delta",
            "Set AWS_BEARER_TOKEN_BEDROCK and I can answer questions about this workflow.",
        )
        yield "history", "[]"
        return

    agent = create_deep_agent(
        model=driver_model(settings.assistant_model),
        instructions=f"{BASE_PROMPT}\n\n{INSTRUCTIONS}",
        tools=tools_for(request.graph, models, known),
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

    history: list[ModelMessage] = (
        ModelMessagesTypeAdapter.validate_python(request.history) if request.history else []
    )

    # run_stream stops at the first response carrying text, and a tool-using
    # agent's first response is a tool call beside an empty text part. The
    # event stream runs the whole loop and hands over text as it appears.
    async with agent.run_stream_events(
        request.question,
        deps=create_default_deps(),
        message_history=history,
        usage_limits=UsageLimits(request_limit=TOOL_CALLS + 2),
    ) as events:
        async for event in events:
            if isinstance(event, PartStartEvent) and isinstance(event.part, TextPart):
                if event.part.content:
                    yield "delta", event.part.content
            elif isinstance(event, PartDeltaEvent) and isinstance(event.delta, TextPartDelta):
                yield "delta", event.delta.content_delta
            elif isinstance(event, AgentRunResultEvent):
                LEDGER.charge(DEFAULT_MODELS, settings.assistant_model, event.result)
                messages = event.result.all_messages()
                yield "history", ModelMessagesTypeAdapter.dump_json(messages).decode()

"""The assistant that answers questions about the open graph.

It reads. It does not edit. A helper that quietly rewrites the canvas is
hard to trust, and the optimizer already exists for changing a graph on
purpose. What this one has is context: the graph, its stage bindings, the
model registry with its rates, and whatever the validator is complaining
about. Most questions someone asks while building are answerable from
those four things.

The graph goes in the agent's instructions rather than in the prompt.
pydantic-ai rebuilds instructions on every run and keeps them out of the
message history, so each question is answered against the graph as it
stands now, and an edit between two questions is picked up without the
history carrying a stale copy of it.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from pydantic import BaseModel, Field
from pydantic_ai import Agent
from pydantic_ai.messages import ModelMessage, ModelMessagesTypeAdapter

from orla.estimate import estimate
from orla.graph import AgentGraph, validate_graph
from orla.models import ModelSpec, capability_problems, driver_model
from orla.settings import settings

INSTRUCTIONS = """
You are the assistant inside a workflow builder, talking with the person
building the workflow shown below. Answer them the way a helpful colleague
would. A greeting gets a greeting and a one line offer of what you can help
with. Never describe the message you were sent, and never say what was not
asked for.

Answer in two or three sentences. Name the stages and the models involved
rather than talking in general terms, and give the number when there is one.

When someone asks how to change the graph, say what to change and where. Do
not offer to make the change yourself, because you cannot edit the canvas.

Before calling one model cheaper or dearer than another, read both of their
rates out of the registry below and quote both numbers. A larger model is
often the dearer one, and the registry is the only thing that settles it.

When the graph does not tell you the answer, say so in one sentence rather
than guessing. Use no em-dashes.
"""


class AskRequest(BaseModel):
    graph: AgentGraph
    question: str
    # pydantic-ai's own message history, round-tripped through the client so
    # the conversation keeps its shape without this module inventing one.
    history: list[Any] = Field(default_factory=list)


def context(graph: AgentGraph, models: list[ModelSpec], known: set[str]) -> str:
    """Everything the assistant is allowed to reason from."""

    priced = estimate(graph, models)
    problems = validate_graph(graph, known) + capability_problems(graph, models)

    rates = "\n".join(
        f"- {m.id}: {m.label}, ${m.input_usd_per_mtok} in and ${m.output_usd_per_mtok} out "
        f"per million tokens, quality prior {m.quality_prior}"
        for m in models
    )
    per_stage = "\n".join(
        f"- {row.name}: {row.model}, about ${row.usd:.6f} per request, "
        f"{row.input_tokens} input and {row.output_tokens} output tokens"
        for row in priced.nodes
    )
    faults = "\n".join(f"- {p.severity}: {p.message}" for p in problems) or "None."

    return f"""
{INSTRUCTIONS}

## The graph

```json
{graph.model_dump_json(indent=2)}
```

## What each stage costs, estimated

{per_stage or "No stage makes a model call yet."}

Estimated total: ${priced.usd:.6f} per request.

## The model registry

{rates}

## What the validator says

{faults}
""".strip()


async def ask(
    request: AskRequest, models: list[ModelSpec], known: set[str]
) -> AsyncIterator[tuple[str, str]]:
    """Stream an answer as (event, data) pairs. Text arrives in deltas so the
    panel fills as it goes, and the closing event carries the history the next
    question should be asked with."""

    if not settings.has_model_credentials:
        yield "delta", "Set AWS_BEARER_TOKEN_BEDROCK and I can answer questions about this graph."
        yield "history", "[]"
        return

    agent = Agent[None, str](
        driver_model(settings.assistant_model),
        instructions=context(request.graph, models, known),
        model_settings={"max_tokens": 1024},
    )

    history: list[ModelMessage] = (
        ModelMessagesTypeAdapter.validate_python(request.history) if request.history else []
    )

    async with agent.run_stream(request.question, message_history=history) as result:
        async for delta in result.stream_text(delta=True):
            yield "delta", delta
        yield "history", ModelMessagesTypeAdapter.dump_json(result.all_messages()).decode()

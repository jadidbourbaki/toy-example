"""The assistant that answers questions about the open graph.

It reads. It does not edit. A helper that quietly rewrites the canvas is
hard to trust, and the optimizer already exists for changing a graph on
purpose. What this one has is context: the graph, its stage bindings, the
model registry with its rates, and whatever the validator is complaining
about. Most questions someone asks while building are answerable from
those four things.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from sketch.estimate import estimate
from sketch.graph import AgentGraph, validate_graph
from sketch.models import ModelSpec, driver_model
from sketch.settings import settings

INSTRUCTIONS = """
You answer questions about the agent graph someone is building. You are shown
the graph, what each stage costs, and any problems the validator found.

Answer in two or three sentences. Name the stages and the models involved
rather than talking in general terms, and give the number when there is one.

When someone asks how to change the graph, say what to change and where. Do
not offer to make the change yourself, because you cannot edit the canvas.

When the graph does not tell you the answer, say so in one sentence rather
than guessing. Use no em-dashes.
"""


class Turn(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class AskRequest(BaseModel):
    graph: AgentGraph
    question: str
    history: list[Turn] = Field(default_factory=list)


def context(graph: AgentGraph, models: list[ModelSpec], known: set[str]) -> str:
    """Everything the assistant is allowed to reason from."""

    priced = estimate(graph, models)
    problems = validate_graph(graph, known)

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
    faults = (
        "\n".join(f"- {p.severity}: {p.message}" for p in problems) or "None. The graph is valid."
    )

    return f"""
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


async def ask(request: AskRequest, models: list[ModelSpec], known: set[str]) -> AsyncIterator[str]:
    """Stream an answer. Text arrives in deltas so the panel fills as it goes."""

    if not settings.has_model_credentials:
        yield "Set AWS_BEARER_TOKEN_BEDROCK and I can answer questions about this graph."
        return

    agent = Agent[None, str](
        driver_model(settings.assistant_model),
        instructions=INSTRUCTIONS,
        model_settings={"max_tokens": 1024},
    )

    conversation = "\n\n".join(f"{turn.role}: {turn.text}" for turn in request.history[-6:])
    prompt = context(request.graph, models, known)
    if conversation:
        prompt += f"\n\n## Earlier in this conversation\n\n{conversation}"
    prompt += f"\n\n## The question\n\n{request.question}"

    async with agent.run_stream(prompt) as result:
        async for delta in result.stream_text(delta=True):
            yield delta

"""Research brief

Sharpen a vague question, gather notes on it, and write a short brief.

Generated from a sketch graph. Every model call is tagged with the stage
it serves, and STAGES decides which model serves each stage, so
retargeting a stage is a one line edit.
"""

from __future__ import annotations

import asyncio
import os
from string import Template
from typing import Any

from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits
from pydantic_deep import BASE_PROMPT, create_deep_agent, create_default_deps

MODELS: dict[str, str] = {
    "glm-4.7-flash": "zai.glm-4.7-flash",
    "qwen3-coder-30b": "qwen.qwen3-coder-30b-a3b-instruct",
}

STAGES: dict[str, str] = {
    "answer": "qwen3-coder-30b",
    "clarify": "glm-4.7-flash",
    "research": "qwen3-coder-30b",
}

REGION = os.environ.get("AWS_REGION", "us-west-2")
BASE_URL = "https://bedrock-mantle." + REGION + ".api.aws/v1"


def model_for(stage: str) -> OpenAIChatModel:
    """The model serving a stage right now."""

    provider = OpenAIProvider(base_url=BASE_URL, api_key=os.environ["AWS_BEARER_TOKEN_BEDROCK"])
    return OpenAIChatModel(MODELS[STAGES[stage]], provider=provider)


def fill(template: str, values: dict[str, Any]) -> str:
    """Substitute ${name} references with the outputs upstream stages produced."""

    return Template(template).safe_substitute(values)


NOTES: list[tuple[str, str]] = [
    (
        "retrieval",
        "Chunk overlap above 20 percent mostly adds cost. Measure recall before raising it.",
    ),
    (
        "routing",
        "A classifier in front of two specialists beats one generalist when the classes are far apart.",
    ),
]


def search_notes(query: str) -> str:
    """Search the built-in corpus of engineering notes."""

    terms = [t for t in query.lower().split() if len(t) > 2]
    hits = [
        f"[{topic}] {body}"
        for topic, body in NOTES
        if any(t in topic or t in body.lower() for t in terms)
    ]
    return "\n".join(hits) if hits else "No notes matched that query."


deps = create_default_deps()

clarify_agent = Agent(
    model_for("clarify"),
    instructions="Rewrite a vague question into one precise question. Answer with the question alone.",
)

research_agent = create_deep_agent(
    model=model_for("research"),
    instructions=f"{BASE_PROMPT}\n\nSearch the notes before answering. Cite the topic tag of every note you use.",
    tools=[search_notes],
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

brief_agent = Agent(
    model_for("answer"),
    instructions="Write a brief of at most six sentences. Open with the answer.",
)


async def research_brief_run(request: str) -> str:
    """Run Research brief once and return its output."""

    values: dict[str, Any] = {"input": request}

    values["clarify"] = (await clarify_agent.run(fill("${input}", values))).output

    research_result = await research_agent.run(
        fill("Gather what the notes say about: ${clarify}", values),
        deps=deps,
        usage_limits=UsageLimits(request_limit=6),
    )
    values["research"] = str(research_result.output)

    values["brief"] = (
        await brief_agent.run(fill("Question: ${clarify}\n\nFindings: ${research}", values))
    ).output

    return str(values["brief"])


if __name__ == "__main__":
    import sys

    question = " ".join(sys.argv[1:]) or "How should I tune retrieval?"
    print(asyncio.run(research_brief_run(question)))

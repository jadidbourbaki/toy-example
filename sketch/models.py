"""The model registry and the tool catalog.

A node names a model by registry id rather than by provider model
string, so retargeting a stage is a one word edit and the cost estimate
has rates to work with.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Provider = Literal["anthropic", "openai", "bedrock", "ollama"]


class ModelSpec(BaseModel):
    """One inference endpoint a stage can be bound to. quality_prior is
    the operator's own belief about how strong the model is, on a zero
    to one scale, and it is what the optimizer trades against cost."""

    id: str
    provider: Provider
    model: str
    label: str = ""
    endpoint: str = ""
    api_key_var: str = ""
    input_usd_per_mtok: float = 0.0
    output_usd_per_mtok: float = 0.0
    quality_prior: float = 0.5


class ToolSpec(BaseModel):
    """One entry in the tool catalog. The prototype ships offline
    implementations so a graph runs with no credentials beyond the model
    key."""

    id: str
    label: str
    description: str
    parameters: list[str] = Field(default_factory=list)


DEFAULT_MODELS: list[ModelSpec] = [
    ModelSpec(
        id="haiku",
        provider="anthropic",
        model="claude-haiku-4-5-20251001",
        label="Claude Haiku 4.5",
        api_key_var="ANTHROPIC_API_KEY",
        input_usd_per_mtok=1.0,
        output_usd_per_mtok=5.0,
        quality_prior=0.62,
    ),
    ModelSpec(
        id="sonnet",
        provider="anthropic",
        model="claude-sonnet-5",
        label="Claude Sonnet 5",
        api_key_var="ANTHROPIC_API_KEY",
        input_usd_per_mtok=3.0,
        output_usd_per_mtok=15.0,
        quality_prior=0.86,
    ),
    ModelSpec(
        id="opus",
        provider="anthropic",
        model="claude-opus-5",
        label="Claude Opus 5",
        api_key_var="ANTHROPIC_API_KEY",
        input_usd_per_mtok=5.0,
        output_usd_per_mtok=25.0,
        quality_prior=0.95,
    ),
    ModelSpec(
        id="local-qwen",
        provider="ollama",
        model="qwen3:8b",
        label="Qwen3 8B on Ollama",
        endpoint="http://localhost:11434/v1",
        input_usd_per_mtok=0.0,
        output_usd_per_mtok=0.0,
        quality_prior=0.35,
    ),
]

TOOL_CATALOG: list[ToolSpec] = [
    ToolSpec(
        id="echo",
        label="Echo",
        description="Return the text it is given. Useful as a placeholder while a graph is being sketched.",
        parameters=["text"],
    ),
    ToolSpec(
        id="calculator",
        label="Calculator",
        description="Evaluate an arithmetic expression over numbers, parentheses, and the four operators.",
        parameters=["expression"],
    ),
    ToolSpec(
        id="word_count",
        label="Word count",
        description="Count words, characters, and lines in a block of text.",
        parameters=["text"],
    ),
    ToolSpec(
        id="search_notes",
        label="Search notes",
        description="Search a small built-in corpus of notes and return the matching entries.",
        parameters=["query"],
    ),
    ToolSpec(
        id="read_file",
        label="Read file",
        description="Read a UTF-8 text file from the workspace directory.",
        parameters=["path"],
    ),
]


def by_id(models: list[ModelSpec], model_id: str) -> ModelSpec | None:
    return next((m for m in models if m.id == model_id), None)


def tool_by_id(tool_id: str) -> ToolSpec | None:
    return next((t for t in TOOL_CATALOG if t.id == tool_id), None)


def provider_model_string(spec: ModelSpec) -> str:
    """The pydantic-ai model string for a registry entry. Ollama speaks
    the OpenAI protocol, so it is reached through the openai provider
    pointed at a local endpoint."""

    if spec.provider == "ollama":
        return f"openai:{spec.model}"
    if spec.provider == "bedrock":
        return f"bedrock:{spec.model}"
    return f"{spec.provider}:{spec.model}"

"""The model registry and the tool catalog.

A node names a model by registry id rather than by provider model
string, so retargeting a stage is a one word edit and the cost estimate
has rates to work with.
"""

from __future__ import annotations

import os
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai.models import Model
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

Provider = Literal["bedrock-mantle", "anthropic", "openai", "ollama"]

# Bedrock serves models through two endpoints with two different catalogues.
# bedrock-runtime carries the AWS-native Converse API. bedrock-mantle carries
# the OpenAI-compatible one, and it is where the current open-weight models
# live. Talking to it needs a base URL and a key, which is the same shape as
# talking to any other OpenAI-compatible server.
MANTLE_HOST = "https://bedrock-mantle.{region}.api.aws/v1"


def mantle_base_url(region: str | None = None) -> str:
    return MANTLE_HOST.format(region=region or os.environ.get("AWS_REGION", "us-west-2"))


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


def _bedrock(
    entry_id: str, model: str, label: str, price_in: float, price_out: float, prior: float
) -> ModelSpec:
    return ModelSpec(
        id=entry_id,
        provider="bedrock-mantle",
        model=model,
        label=label,
        endpoint=MANTLE_HOST,
        api_key_var="AWS_BEARER_TOKEN_BEDROCK",
        input_usd_per_mtok=price_in,
        output_usd_per_mtok=price_out,
        quality_prior=prior,
    )


# Open-weight models on the bedrock-mantle endpoint, each one verified to call
# tools and to return structured output. Rates come from the AWS price list and
# are quoted per million tokens. quality_prior is the operator's own belief and
# is meant to be edited.
#
# The ladder is not a straight line, which is the point. Nemotron Super 120B
# costs the same per input token as Qwen3 Coder 30B while being far larger, and
# GLM 4.7 Flash costs a tenth of GLM 5. Which model is cheapest for a stage
# depends on whether the stage reads a lot or writes a lot, so a binding is
# worth measuring rather than guessing.
DEFAULT_MODELS: list[ModelSpec] = [
    _bedrock(
        "nemotron-nano-30b", "nvidia.nemotron-nano-3-30b", "Nemotron Nano 3 30B", 0.06, 0.24, 0.48
    ),
    _bedrock("glm-4.7-flash", "zai.glm-4.7-flash", "GLM 4.7 Flash", 0.07, 0.40, 0.60),
    _bedrock(
        "qwen3-coder-30b", "qwen.qwen3-coder-30b-a3b-instruct", "Qwen3 Coder 30B", 0.15, 0.60, 0.66
    ),
    _bedrock(
        "nemotron-super-120b",
        "nvidia.nemotron-super-3-120b",
        "Nemotron Super 3 120B",
        0.15,
        0.65,
        0.76,
    ),
    _bedrock("minimax-m2.5", "minimax.minimax-m2.5", "MiniMax M2.5", 0.30, 1.20, 0.80),
    _bedrock(
        "qwen3-coder-480b",
        "qwen.qwen3-coder-480b-a35b-instruct",
        "Qwen3 Coder 480B",
        0.45,
        1.80,
        0.84,
    ),
    _bedrock("kimi-k2.5", "moonshotai.kimi-k2.5", "Kimi K2.5", 0.60, 3.00, 0.88),
    _bedrock("glm-5", "zai.glm-5", "GLM 5", 1.00, 3.20, 0.92),
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
    """How a registry entry is named in generated code."""

    if spec.provider in ("bedrock-mantle", "ollama"):
        return spec.model
    return f"{spec.provider}:{spec.model}"


def build_model(spec: ModelSpec) -> Model | str:
    """A pydantic-ai model for a registry entry. An OpenAI-compatible server
    needs a base URL and a key rather than a name, so those entries are built
    rather than named."""

    if spec.provider in ("bedrock-mantle", "ollama"):
        base_url = mantle_base_url() if spec.provider == "bedrock-mantle" else spec.endpoint
        key = os.environ.get(spec.api_key_var, "") if spec.api_key_var else "unused"
        return OpenAIChatModel(spec.model, provider=OpenAIProvider(base_url=base_url, api_key=key))
    return provider_model_string(spec)


def driver_model(name: str) -> Model | str:
    """The model that drives the compiler, the optimizer, or the judge. A
    registry id resolves through the registry so those tools reach the same
    endpoint a stage does. Anything else is passed through as a pydantic-ai
    model name, which is how a different provider gets used without editing
    the registry."""

    spec = by_id(DEFAULT_MODELS, name)
    return build_model(spec) if spec else name

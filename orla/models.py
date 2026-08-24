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

from orla.graph import AgentGraph, LLMConfig, Problem, ReactConfig, RouterConfig
from orla.settings import settings

Provider = Literal["bedrock-mantle", "bedrock-runtime", "anthropic", "openai", "ollama"]

# Bedrock serves models through two endpoints with two different catalogues,
# and the registry uses both. bedrock-mantle speaks the OpenAI protocol and
# carries the current open-weight models. bedrock-runtime speaks the AWS-native
# Converse API and carries a different set, including models that never moved
# across. A registry entry names which endpoint serves it, so adding a model
# from either side is one row.
MANTLE_HOST = "https://bedrock-mantle.{region}.api.aws/v1"


def mantle_base_url(region: str | None = None) -> str:
    return MANTLE_HOST.format(region=region or settings.aws_region)


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
    # Not every model can do everything. A ReAct stage needs tool calling and a
    # router needs a typed result, so a model missing either one is usable for a
    # plain call and nothing else. Binding it anywhere else is caught by
    # validation rather than failing at run time.
    tools: bool = True
    structured: bool = True


class ToolSpec(BaseModel):
    """One entry in the tool catalog. The prototype ships offline
    implementations so a graph runs with no credentials beyond the model
    key."""

    id: str
    label: str
    description: str
    parameters: list[str] = Field(default_factory=list)


def _bedrock(
    entry_id: str,
    model: str,
    label: str,
    price_in: float,
    price_out: float,
    prior: float,
    provider: Provider = "bedrock-mantle",
    tools: bool = True,
    structured: bool = True,
) -> ModelSpec:
    return ModelSpec(
        id=entry_id,
        provider=provider,
        model=model,
        label=label,
        endpoint=MANTLE_HOST if provider == "bedrock-mantle" else "",
        api_key_var="AWS_BEARER_TOKEN_BEDROCK",
        input_usd_per_mtok=price_in,
        output_usd_per_mtok=price_out,
        quality_prior=prior,
        tools=tools,
        structured=structured,
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
    # Served by Converse on bedrock-runtime rather than by mantle. The registry
    # ships only models that can do everything a stage might need, so nothing in
    # the picker is a trap. The capability flags stay because a model added
    # later may not clear that bar.
    _bedrock(
        "llama4-maverick",
        "us.meta.llama4-maverick-17b-instruct-v1:0",
        "Llama 4 Maverick 17B",
        0.24,
        0.97,
        0.78,
        provider="bedrock-runtime",
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
    """How a registry entry is named in generated code."""

    if spec.provider in ("bedrock-mantle", "ollama"):
        return spec.model
    if spec.provider == "bedrock-runtime":
        return f"bedrock:{spec.model}"
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


def capability_problems(graph: AgentGraph, models: list[ModelSpec]) -> list[Problem]:
    """Stages bound to a model that cannot do what the stage needs. A ReAct
    stage calls tools and a router returns one of a fixed set of labels, so a
    model missing either capability fails at run time. Saying so on the canvas
    is cheaper than finding out during a run."""

    problems: list[Problem] = []
    for node in graph.nodes:
        config = node.config
        if not isinstance(config, LLMConfig | ReactConfig | RouterConfig):
            continue
        model_id = config.model
        if not model_id:
            problems.append(
                Problem(
                    severity="error",
                    node_id=node.id,
                    message=f"{node.name} has no model. Pick one from the registry.",
                )
            )
            continue
        spec = by_id(models, model_id)
        if spec is None:
            problems.append(
                Problem(
                    severity="error",
                    node_id=node.id,
                    message=f"The registry has no model named {model_id!r}.",
                )
            )
            continue
        if isinstance(config, ReactConfig) and not spec.tools:
            problems.append(
                Problem(
                    severity="error",
                    node_id=node.id,
                    message=f"{node.name} is a ReAct loop, and {spec.label} cannot call tools. Bind it to a model that can, or make this a plain model call.",
                )
            )
        if isinstance(config, RouterConfig) and not spec.structured:
            problems.append(
                Problem(
                    severity="error",
                    node_id=node.id,
                    message=f"{node.name} is a router, and {spec.label} cannot return one of a fixed set of labels. Bind it to a model that can.",
                )
            )
    return problems

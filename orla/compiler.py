"""Compile an agent graph into a runnable pydantic-deep module.

A model writes the source. Templates would only ever reach the slice of
the pydantic-deep API somebody hardcoded, and the library is wide enough
that the slice would always be the wrong one.

What replaces determinism is validation. Generated source has to parse,
survive pyflakes, define the graph's entry function, and route every
model call through a STAGES table naming a model for each stage. A
failure goes back to the model once, quoting the problem.
"""

from __future__ import annotations

import ast
import asyncio
import json
import re
import subprocess
import tempfile
from collections.abc import AsyncIterator
from importlib import resources
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from orla.graph import AgentGraph, SubagentConfig
from orla.models import ModelSpec, by_id, driver_model, provider_model_string
from orla.settings import settings

MAX_ATTEMPTS = 2


def entry_name(graph_id: str) -> str:
    """The entry function a compiled graph must define."""

    cleaned = re.sub(r"[^0-9A-Za-z_]", "_", graph_id)
    prefix = cleaned if cleaned[:1].isalpha() or cleaned[:1] == "_" else f"g_{cleaned}"
    return f"{prefix}_run"


class CompiledModule(BaseModel):
    """What the compiler model returns."""

    source: str = Field(description="The complete Python module, with no markdown fence around it.")
    notes: str = Field(default="", description="One or two sentences on any judgement call made.")


class CompileResult(BaseModel):
    source: str
    notes: str = ""
    attempts: int = 0
    problems: list[str] = Field(default_factory=list)
    ok: bool = True


class CompileEvent(BaseModel):
    """Progress from a compile. Writing the module takes long enough that
    silence reads as a hang, and the checks it runs are worth watching."""

    type: Literal["writing", "checking", "rejected", "done", "error"]
    attempt: int = 0
    problems: list[str] = Field(default_factory=list)
    result: CompileResult | None = None
    text: str = ""


def _asset(name: str) -> str:
    return resources.files("orla.prompts").joinpath(name).read_text(encoding="utf-8")


def stages_of(graph: AgentGraph) -> dict[str, str]:
    """Which model each stage in the graph is bound to."""

    bindings: dict[str, str] = {}
    for node in graph.nodes:
        stage = getattr(node.config, "stage", "")
        model = getattr(node.config, "model", "")
        if stage and model:
            bindings.setdefault(stage, model)
    return bindings


def resolve_network(graph: AgentGraph, workspace: list[AgentGraph]) -> list[AgentGraph]:
    """Every graph the run needs, dependencies before dependents."""

    index = {g.id: g for g in workspace} | {graph.id: graph}
    ordered: list[AgentGraph] = []
    seen: set[str] = set()

    def visit(current: AgentGraph) -> None:
        if current.id in seen:
            return
        seen.add(current.id)
        for node in current.nodes:
            if isinstance(node.config, SubagentConfig) and node.config.graph_id in index:
                visit(index[node.config.graph_id])
        ordered.append(current)

    visit(graph)
    return ordered


def _pyflakes(source: str) -> list[str]:
    """Real defects in the source: undefined names, unused imports,
    redefinitions. Line length is left alone, since a prompt literal is
    as long as the prompt."""

    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "generated.py"
        path.write_text(source, encoding="utf-8")
        result = subprocess.run(
            [
                "ruff",
                "check",
                "--select",
                "F,E9",
                "--output-format",
                "concise",
                "--no-cache",
                str(path),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    if result.returncode == 0:
        return []
    # ruff's concise output ends with a summary line and a fixability hint.
    # Only the diagnostics themselves are worth quoting back to the model.
    diagnostic = re.compile(rf"^{re.escape(str(path))}:\d+:\d+: ")
    return [
        line.replace(f"{path}:", "line ")
        for line in result.stdout.splitlines()
        if diagnostic.match(line)
    ]


def _string_keys(node: ast.AST) -> set[str]:
    if not isinstance(node, ast.Dict):
        return set()
    return {k.value for k in node.keys if isinstance(k, ast.Constant) and isinstance(k.value, str)}


def validate(source: str, graph: AgentGraph, network: list[AgentGraph]) -> list[str]:
    """Every reason the generated module is unacceptable."""

    problems: list[str] = []

    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        return [f"The module does not parse: line {exc.lineno}, {exc.msg}."]

    problems.extend(_pyflakes(source))

    functions = {
        n.name for n in ast.walk(tree) if isinstance(n, ast.AsyncFunctionDef | ast.FunctionDef)
    }
    for member in network:
        wanted = entry_name(member.id)
        if wanted not in functions:
            problems.append(f"The module must define `async def {wanted}(request: str) -> str`.")

    stages_table: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign):
            targets = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if "STAGES" in targets:
                stages_table |= _string_keys(node.value)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.target.id == "STAGES" and node.value is not None:
                stages_table |= _string_keys(node.value)

    wanted_stages = set()
    for member in network:
        wanted_stages |= set(stages_of(member))

    if wanted_stages and not stages_table:
        problems.append(
            "The module must define a module-level STAGES dict mapping every stage name to a model id."
        )
    for missing in sorted(wanted_stages - stages_table):
        problems.append(f"STAGES is missing the stage {missing!r}, which the graph uses.")

    if "model_for" not in functions and wanted_stages:
        problems.append(
            "The module must define `model_for(stage)` and route every model call through it."
        )

    return problems


def _system_prompt() -> str:
    return f"""
You compile a visual agent graph into one runnable Python module built on
pydantic-ai and pydantic-deep. You return the module source and nothing else.

## Node kinds and how each one compiles

- `input` seeds the request into the values dict under the node's name.
- `output` returns the joined outputs of the nodes feeding it.
- `llm` is a plain `pydantic_ai.Agent` with the node's instructions, run once.
- `tool` calls a plain Python function from the tool catalog. No model.
- `react` is `create_deep_agent` with the node's tools. Compose its
  instructions with `BASE_PROMPT` so the harness keeps its tool discipline.

  Put the node's tool budget in the instructions, saying it may call tools at
  most `max_iterations` times and should answer from what it has once the
  budget is spent. Then set `UsageLimits(request_limit=max_iterations + 2)` as
  a backstop. `request_limit` raises rather than stopping the loop, so a limit
  set exactly at the budget turns a stage that wanted one more turn into a
  failed run.

  A node's tool list is exhaustive. `create_deep_agent` turns on a great deal
  by default, so every default the node did not ask for gets switched off
  explicitly: `web_search=False`, `web_fetch=False`, `thinking=False`,
  `include_todo=False`, `include_filesystem=False`, `include_execute=False`,
  `include_subagents=False`, `include_skills=False`,
  `include_builtin_subagents=False`, `include_plan=False`, and
  `include_memory=False`. Turn one back on only when the node asks for it.
  An agent that quietly reaches the web when the canvas shows two tools is
  wrong, and the defaults also pull in optional dependencies.

  A deep agent needs its dependencies at run time. Build them once at module
  level with `deps = create_default_deps()` and pass `deps=deps` to every
  `.run()` on a deep agent. Running one without deps raises an
  AttributeError inside the harness.
- `router` is an `Agent` with `output_type=Literal[...]` over its route
  labels. Nodes reachable only through a route the router did not pick are
  skipped for that run.
- `judge` judges the stage feeding it. Build an `Agent` with
  `output_type=Verdict` where `Verdict` is a pydantic model with `passed: bool`
  and `feedback: str`. Judge the feeding stage's output against the criteria.
  On a fail, run the feeding stage again with the feedback appended to its
  prompt, up to `max_rounds` times. Store the surviving answer under the
  feeding stage's own name so later stages read the revised version.
- `approve` pauses for a person. Give every entry function a keyword
  parameter `approve: Callable[[str, str], Decision]` with a default that
  asks on the console, where `Decision` is a pydantic model with
  `approved: bool` and `note: str`. Call it with the node's question and the
  feeding stage's output. An approval lets the output through under the
  approve node's name. A refusal with a note runs the Prompt or Agent behind
  the approve stage again with the note appended, up to `max_rounds` times,
  and asks again. A refusal without a note returns a sentence saying where
  the run stopped, and nothing after the approve stage runs.
- `subagent` calls another graph's entry function. Compile every graph in the
  network into the same module, dependencies first.

## Hard requirements

The module must satisfy all of these, and the result is rejected otherwise.

1. It parses and passes `ruff check --select F,E9`. No unused imports, no
   undefined names.
2. It defines `async def <graph_id>_run(request: str) -> str` for every graph
   in the network, with the id sanitized to a Python identifier. Further
   keyword parameters with defaults are fine, and an `approve` stage needs
   one.
3. It defines a module-level `STAGES` dict naming a model id for every stage
   the graph uses, a `MODELS` dict naming the provider model string for every
   model id, and `model_for(stage)`. Every model call resolves its model
   through `model_for`, so retargeting a stage is a one line edit.

   These models are served by the Bedrock mantle endpoint, which speaks the
   OpenAI protocol. So `model_for` returns a built model rather than a name:

   ```python
   REGION = os.environ.get("AWS_REGION", "us-west-2")
   BASE_URL = "https://bedrock-mantle." + REGION + ".api.aws/v1"


   def model_for(stage: str) -> OpenAIChatModel:
       # The model serving a stage right now.
       provider = OpenAIProvider(
           base_url=BASE_URL, api_key=os.environ["AWS_BEARER_TOKEN_BEDROCK"]
       )
       return OpenAIChatModel(MODELS[STAGES[stage]], provider=provider)
   ```

   Import those two from `pydantic_ai.models.openai` and
   `pydantic_ai.providers.openai`.

   The registry uses two Bedrock endpoints. A model string that already starts
   with `bedrock:` is served by the Converse API and is handed to `Agent`
   unchanged. A bare model id is served by mantle and is built as above. So
   `model_for` branches on the prefix:

   ```python
   def model_for(stage: str) -> OpenAIChatModel | str:
       name = MODELS[STAGES[stage]]
       if name.startswith("bedrock:"):
           return name
       provider = OpenAIProvider(
           base_url=BASE_URL, api_key=os.environ["AWS_BEARER_TOKEN_BEDROCK"]
       )
       return OpenAIChatModel(name, provider=provider)
   ```
4. Templates in prompts use `${{name}}` and are filled through a `fill`
   helper built on `string.Template.safe_substitute`, so a prompt that
   contains braces survives.
5. Tool functions are defined in the module with real bodies, so the file
   runs on its own.

## Style

Follow the worked example's shape. Type every signature. Put
`from __future__ import annotations` first. Write a module docstring naming
the graph. Comment only where the reason is non-obvious. Use no em-dashes.

## Worked example

A graph:

```json
{_asset("customer_support.json")}
```

compiles to:

```python
{_asset("example_module.py")}
```

## The pydantic-deep API

{_asset("pydantic_deep_api.md")}
""".strip()


def _task_prompt(
    graph: AgentGraph, network: list[AgentGraph], models: list[ModelSpec], tool_sources: str
) -> str:
    used_models = sorted(
        {m for g in network for n in g.nodes if (m := getattr(n.config, "model", ""))}
    )
    registry_lines = []
    for model_id in used_models:
        spec = by_id(models, model_id)
        target = provider_model_string(spec) if spec else model_id
        registry_lines.append(f"- {model_id} -> {target}")

    graphs_json = json.dumps([g.model_dump() for g in network], indent=2)
    entries = ", ".join(entry_name(g.id) for g in network)

    return f"""
Compile this network into one module. The entry point the caller uses is
`{entry_name(graph.id)}`. Define these entry functions: {entries}.

## Model registry

{chr(10).join(registry_lines)}

## Tool catalog implementations

Copy the bodies of any tools the graph uses into the module verbatim.

```python
{tool_sources}
```

## The graphs, dependencies first

```json
{graphs_json}
```
""".strip()


def _tool_sources() -> str:
    from orla import tools

    path = Path(tools.__file__)
    return path.read_text(encoding="utf-8")


async def compile_stream(
    graph: AgentGraph,
    models: list[ModelSpec],
    workspace: list[AgentGraph] | None = None,
) -> AsyncIterator[CompileEvent]:
    """Ask the compiler model for the module, check it, and retry once with
    the problems quoted back. Each step is reported as it happens."""

    network = resolve_network(graph, workspace or [])

    if not settings.has_model_credentials:
        yield CompileEvent(
            type="error",
            text="Set AWS_BEARER_TOKEN_BEDROCK to compile a graph. The compiler drives a model.",
        )
        return

    agent = Agent[None, CompiledModule](
        driver_model(settings.compiler_model),
        output_type=CompiledModule,
        instructions=_system_prompt(),
        model_settings={"max_tokens": 16384},
    )

    prompt = _task_prompt(graph, network, models, _tool_sources())
    problems: list[str] = []

    for attempt in range(1, MAX_ATTEMPTS + 1):
        message = prompt
        if problems:
            quoted = "\n".join(f"- {p}" for p in problems)
            message = f"{prompt}\n\n## The previous attempt was rejected\n\nFix every problem:\n\n{quoted}"

        yield CompileEvent(type="writing", attempt=attempt)
        run = await agent.run(message)
        source = run.output.source.strip()
        if source.startswith("```"):
            source = source.split("\n", 1)[-1].rsplit("```", 1)[0].strip()

        yield CompileEvent(type="checking", attempt=attempt)
        problems = validate(source, graph, network)

        result = CompileResult(
            source=source,
            notes=run.output.notes,
            attempts=attempt,
            problems=problems,
            ok=not problems,
        )

        if result.ok:
            yield CompileEvent(type="done", attempt=attempt, result=result)
            return

        last = attempt == MAX_ATTEMPTS
        yield CompileEvent(
            type="done" if last else "rejected",
            attempt=attempt,
            problems=problems,
            result=result if last else None,
        )


async def compile_graph(
    graph: AgentGraph,
    models: list[ModelSpec],
    workspace: list[AgentGraph] | None = None,
) -> CompileResult:
    """The compiled module, with the progress along the way discarded."""

    result = CompileResult(source="", ok=False)
    async for event in compile_stream(graph, models, workspace):
        if event.result is not None:
            result = event.result
        elif event.type == "error":
            result = CompileResult(source="", ok=False, problems=[event.text])
    return result


def compile_graph_sync(
    graph: AgentGraph, models: list[ModelSpec], workspace: list[AgentGraph] | None = None
) -> CompileResult:
    return asyncio.run(compile_graph(graph, models, workspace))

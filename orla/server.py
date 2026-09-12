"""The HTTP API and the static host for the built frontend.

Request and response bodies are the same Pydantic models the rest of the
package uses, so the generated TypeScript types describe the wire format
exactly.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from pathlib import Path
from typing import TypeAlias

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, TypeAdapter
from sse_starlette.sse import EventSourceResponse

from orla import assistant, compiler, measure, optimizer
from orla.approvals import APPROVALS, Decision
from orla.auth import OPEN_PATH, BasicAuth
from orla.estimate import GraphEstimate, estimate
from orla.graph import AgentGraph, Problem, validate_graph
from orla.measure import MeasureEvent
from orla.models import TOOL_CATALOG, ModelSpec, ToolSpec, capability_problems
from orla.runner import RunEvent, run_graph
from orla.settings import settings
from orla.store import Workspace, templates

STATIC_DIR = Path(__file__).resolve().parent / "static"


class GraphRequest(BaseModel):
    graph: AgentGraph


class RunRequest(BaseModel):
    graph: AgentGraph
    request: str = "Say hello."
    step: bool = False


class ApproveRequest(BaseModel):
    token: str
    decision: Decision


class SampleRequest(BaseModel):
    graph: AgentGraph
    count: int = 3


class MeasureRequest(BaseModel):
    graph: AgentGraph
    patches: list[optimizer.Patch] = Field(default_factory=list)
    sample: list[str] = Field(default_factory=list)


class PatchRequest(BaseModel):
    graph: AgentGraph
    patches: list[optimizer.Patch] = Field(default_factory=list)


class PatchResponse(BaseModel):
    graph: AgentGraph
    diff: dict[str, list[str]]
    estimate: GraphEstimate


class ValidateResponse(BaseModel):
    problems: list[Problem]
    estimate: GraphEstimate


class Health(BaseModel):
    """Whether the server can call a model, and the workspace defaults the
    settings page shows."""

    ok: bool = True
    model_credentials: bool
    compiler_model: str
    judge_model: str
    assistant_model: str
    measure_budget_usd: float
    workspace: str


def create_app(workspace_root: Path | None = None) -> FastAPI:
    workspace = Workspace(workspace_root or settings.workspace)
    workspace.seed()

    app = FastAPI(title="orla", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    if settings.password:
        app.add_middleware(BasicAuth, username=settings.username, password=settings.password)

    # What a load balancer asks, and the one route that answers without the
    # password. It says the process is up and nothing else.
    @app.get(OPEN_PATH)
    def probe() -> dict[str, bool]:
        return {"ok": True}

    @app.get("/api/health")
    def health() -> Health:
        return Health(
            model_credentials=settings.has_model_credentials,
            compiler_model=settings.compiler_model,
            judge_model=settings.judge_model,
            assistant_model=settings.assistant_model,
            measure_budget_usd=settings.measure_budget_usd,
            workspace=str(workspace.root),
        )

    @app.get("/api/graphs")
    def list_graphs() -> list[AgentGraph]:
        return workspace.all_graphs()

    @app.get("/api/templates")
    def list_templates() -> list[AgentGraph]:
        return templates()

    @app.get("/api/graphs/{graph_id}")
    def read_graph(graph_id: str) -> AgentGraph:
        try:
            return workspace.read(graph_id)
        except FileNotFoundError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.put("/api/graphs/{graph_id}")
    def write_graph(graph_id: str, graph: AgentGraph) -> AgentGraph:
        if graph.id != graph_id:
            raise HTTPException(status_code=400, detail="The body's graph id must match the path.")
        return workspace.write(graph)

    @app.delete("/api/graphs/{graph_id}")
    def delete_graph(graph_id: str) -> dict[str, bool]:
        workspace.delete(graph_id)
        return {"deleted": True}

    @app.get("/api/models")
    def read_models() -> list[ModelSpec]:
        return workspace.models()

    @app.put("/api/models")
    def write_models(models: list[ModelSpec]) -> list[ModelSpec]:
        return workspace.write_models(models)

    @app.get("/api/tools")
    def read_tools() -> list[ToolSpec]:
        return TOOL_CATALOG

    @app.post("/api/validate")
    def validate(body: GraphRequest) -> ValidateResponse:
        known = {g.id for g in workspace.all_graphs()} | {body.graph.id}
        models = workspace.models()
        return ValidateResponse(
            problems=validate_graph(body.graph, known) + capability_problems(body.graph, models),
            estimate=estimate(body.graph, models, workspace.all_graphs()),
        )

    @app.post("/api/compile")
    async def compile_endpoint(body: GraphRequest) -> EventSourceResponse:
        async def stream() -> AsyncIterator[dict[str, str]]:
            async for event in compiler.compile_stream(
                body.graph, workspace.models(), workspace.all_graphs()
            ):
                yield {"event": event.type, "data": event.model_dump_json()}

        return EventSourceResponse(stream())

    @app.post("/api/optimize")
    async def optimize_endpoint(body: GraphRequest) -> optimizer.OptimizeResult:
        return await optimizer.optimize(body.graph, workspace.models())

    @app.post("/api/patch")
    def patch_endpoint(body: PatchRequest) -> PatchResponse:
        patched = optimizer.apply_patches(body.graph, body.patches)
        return PatchResponse(
            graph=patched,
            diff=optimizer.diff(body.graph, patched),
            estimate=estimate(patched, workspace.models(), workspace.all_graphs()),
        )

    @app.post("/api/ask")
    async def ask_endpoint(body: assistant.AskRequest) -> EventSourceResponse:
        known = {g.id for g in workspace.all_graphs()} | {body.graph.id}

        async def stream() -> AsyncIterator[dict[str, str]]:
            async for event, data in assistant.ask(body, workspace.models(), known):
                yield {"event": event, "data": data}

        return EventSourceResponse(stream())

    @app.post("/api/sample")
    async def sample_endpoint(body: SampleRequest) -> list[str]:
        if not settings.has_model_credentials:
            raise HTTPException(
                status_code=400,
                detail="Set AWS_BEARER_TOKEN_BEDROCK to write a sample. It drives a model.",
            )
        return await measure.propose_sample(body.graph, body.count)

    @app.post("/api/measure/plan")
    def measure_plan_endpoint(body: MeasureRequest) -> measure.MeasurePlan:
        sample = body.sample or body.graph.sample
        return measure.plan(body.graph, body.patches, sample, workspace.models())

    @app.post("/api/measure")
    async def measure_endpoint(body: MeasureRequest) -> EventSourceResponse:
        sample = body.sample or body.graph.sample

        async def stream() -> AsyncIterator[dict[str, str]]:
            async for event in measure.measure(
                body.graph,
                body.patches,
                sample,
                workspace.models(),
                workspace.root,
                workspace.all_graphs(),
            ):
                yield {"event": event.type, "data": event.model_dump_json()}

        return EventSourceResponse(stream())

    @app.post("/api/run")
    async def run_endpoint(body: RunRequest) -> EventSourceResponse:
        async def stream() -> AsyncIterator[dict[str, str]]:
            async for event in run_graph(
                body.graph,
                body.request,
                workspace.models(),
                workspace.root,
                workspace.all_graphs(),
                APPROVALS,
                body.step,
            ):
                yield {"event": event.type, "data": event.model_dump_json()}

        return EventSourceResponse(stream())

    @app.post("/api/approve")
    def approve_endpoint(body: ApproveRequest) -> dict[str, bool]:
        if not APPROVALS.answer(body.token, body.decision):
            raise HTTPException(status_code=404, detail="No run is waiting on that token.")
        return {"answered": True}

    @app.get("/api/schema")
    def schema() -> dict[str, object]:
        return wire_schema()

    if STATIC_DIR.is_dir():
        app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

    return app


class Wire(BaseModel):
    """Every model the HTTP API puts on the wire, gathered so one schema
    document carries all of them and their nested types together. The
    frontend's types are generated from the document, which is why no
    TypeScript in this repo restates a Pydantic model."""

    graph: AgentGraph
    problem: Problem
    model_spec: ModelSpec
    tool_spec: ToolSpec
    graph_estimate: GraphEstimate
    decision: Decision
    compile_result: compiler.CompileResult
    compile_event: compiler.CompileEvent
    optimize_result: optimizer.OptimizeResult
    patch: optimizer.Patch
    patch_response: PatchResponse
    validate_response: ValidateResponse
    run_event: RunEvent
    measure_plan: measure.MeasurePlan
    measure_event: MeasureEvent
    health: Health


MAPPING_KEYWORDS = frozenset({"properties", "$defs", "definitions", "patternProperties"})

# A JSON document, recursive. TypeAlias keeps the annotation valid on 3.11,
# where the `type` statement does not exist yet.
Json: TypeAlias = "dict[str, Json] | list[Json] | str | int | float | bool | None"


def _strip_titles(node: Json, is_mapping: bool = False) -> Json:
    """Drop the title keyword Pydantic puts on every property, so the type
    generator stops turning each one into a standalone alias.

    is_mapping marks a dict whose keys are field names rather than schema
    keywords. A model with a field named `title` lives in one, and its
    field must survive."""

    if isinstance(node, dict):
        result: dict[str, Json] = {}
        for key, value in node.items():
            if key == "title" and not is_mapping:
                continue
            result[key] = _strip_titles(value, is_mapping=key in MAPPING_KEYWORDS)
        return result
    if isinstance(node, list):
        return [_strip_titles(item) for item in node]
    return node


def wire_schema() -> dict[str, object]:
    """The wire format as one JSON Schema document with a flat
    definitions map, which is the shape the type generator reads."""

    schema = TypeAdapter(Wire).json_schema(
        ref_template="#/definitions/{model}", mode="serialization"
    )
    definitions: dict[str, Json] = {}
    for name, body in schema.get("$defs", {}).items():
        scrubbed = _strip_titles(body)
        if isinstance(scrubbed, dict):
            scrubbed["title"] = name
            scrubbed.setdefault("additionalProperties", False)
            # A field with a default is optional to a parser and still present in
            # every response, because model_dump writes the whole model. Marking
            # each one required describes the wire format the client actually
            # receives, so the frontend is not forced to guard fields that always
            # arrive.
            properties = scrubbed.get("properties")
            if isinstance(properties, dict):
                scrubbed["required"] = sorted(properties)
        definitions[name] = scrubbed
    return {"title": "orla", "definitions": definitions}


def schema_document() -> str:
    return json.dumps(wire_schema(), indent=2)


app = create_app()

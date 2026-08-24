from __future__ import annotations

import json
from pathlib import Path

import pytest

from sketch.graph import AgentGraph
from sketch.models import DEFAULT_MODELS, ModelSpec
from sketch.store import Workspace

ASSETS = Path(__file__).resolve().parent.parent / "sketch" / "prompts"


@pytest.fixture
def models() -> list[ModelSpec]:
    return list(DEFAULT_MODELS)


@pytest.fixture
def brief() -> AgentGraph:
    return AgentGraph.model_validate_json((ASSETS / "example_graph.json").read_text())


@pytest.fixture
def desk() -> AgentGraph:
    return AgentGraph.model_validate_json((ASSETS / "example_triage.json").read_text())


@pytest.fixture
def workspace(tmp_path: Path) -> Workspace:
    space = Workspace(tmp_path / "workspace")
    space.seed()
    return space


def graph_from(nodes: list[dict], edges: list[dict], graph_id: str = "g") -> AgentGraph:
    return AgentGraph.model_validate(
        {"id": graph_id, "name": graph_id, "nodes": nodes, "edges": edges}
    )


def node(node_id: str, name: str, config: dict) -> dict:
    return {"id": node_id, "name": name, "position": {"x": 0, "y": 0}, "config": config}


def edge(edge_id: str, source: str, target: str, label: str = "") -> dict:
    return {"id": edge_id, "source": source, "target": target, "label": label}


def dumps(graph: AgentGraph) -> str:
    return json.dumps(graph.model_dump())

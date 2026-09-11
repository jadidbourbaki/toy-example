"""The workspace: the graphs on disk and the model registry.

One JSON file per graph under `graphs/`, and one `models.json` for the
registry. A workspace small enough to fit in a directory does not need a
database, and keeping graphs as readable files means one can be copied
between workspaces or committed next to the code it generates.
"""

from __future__ import annotations

import json
from importlib import resources
from pathlib import Path

from orla.graph import AgentGraph
from orla.models import DEFAULT_MODELS, ModelSpec

TEMPLATE_ASSETS = (
    "answer.json",
    "research_brief.json",
    "route.json",
    "review.json",
    "customer_support.json",
)

# The one template a fresh workspace opens on. It is the fullest example.
SEED_TEMPLATE = "customer_support"


def templates() -> list[AgentGraph]:
    """The patterns a new workflow can start from, simplest first."""

    return [
        AgentGraph.model_validate_json(resources.files("orla.prompts").joinpath(asset).read_text())
        for asset in TEMPLATE_ASSETS
    ]


class Workspace:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.graphs_dir = root / "graphs"
        self.models_path = root / "models.json"
        self.graphs_dir.mkdir(parents=True, exist_ok=True)

    def graph_path(self, graph_id: str) -> Path:
        safe = "".join(c for c in graph_id if c.isalnum() or c in "_-")
        if not safe:
            raise ValueError(f"{graph_id!r} is not a usable graph id.")
        return self.graphs_dir / f"{safe}.json"

    def all_graphs(self) -> list[AgentGraph]:
        return [
            AgentGraph.model_validate_json(path.read_text(encoding="utf-8"))
            for path in sorted(self.graphs_dir.glob("*.json"))
        ]

    def read(self, graph_id: str) -> AgentGraph:
        path = self.graph_path(graph_id)
        if not path.is_file():
            raise FileNotFoundError(f"No graph named {graph_id!r} in the workspace.")
        return AgentGraph.model_validate_json(path.read_text(encoding="utf-8"))

    def write(self, graph: AgentGraph) -> AgentGraph:
        path = self.graph_path(graph.id)
        path.write_text(graph.model_dump_json(indent=2), encoding="utf-8")
        return graph

    def delete(self, graph_id: str) -> None:
        self.graph_path(graph_id).unlink(missing_ok=True)

    def models(self) -> list[ModelSpec]:
        """The registry, with any model added to the defaults since this
        workspace was created. An edited rate survives, because a stored entry
        always wins over the default of the same id."""

        if not self.models_path.is_file():
            self.write_models(list(DEFAULT_MODELS))
            return list(DEFAULT_MODELS)

        raw = json.loads(self.models_path.read_text(encoding="utf-8"))
        stored = [ModelSpec.model_validate(row) for row in raw]
        known = {spec.id for spec in stored}
        arrived = [spec for spec in DEFAULT_MODELS if spec.id not in known]
        if arrived:
            stored.extend(arrived)
            self.write_models(stored)
        return stored

    def write_models(self, models: list[ModelSpec]) -> list[ModelSpec]:
        payload = [m.model_dump() for m in models]
        self.models_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
        return models

    def seed(self) -> None:
        """Put one worked example in an empty workspace, so a fresh checkout
        opens on something that already runs. The rest are templates."""

        if any(self.graphs_dir.glob("*.json")):
            return
        self.write(next(t for t in templates() if t.id == SEED_TEMPLATE))
        self.models()

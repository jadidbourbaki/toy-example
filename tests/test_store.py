from __future__ import annotations

from pathlib import Path

import pytest

from sketch.graph import AgentGraph
from sketch.models import DEFAULT_MODELS
from sketch.store import Workspace


def test_seed_puts_both_examples_in_an_empty_workspace(workspace: Workspace) -> None:
    assert {s.id for s in workspace.list_graphs()} == {"research_brief", "support_desk"}


def test_seed_leaves_an_occupied_workspace_alone(workspace: Workspace) -> None:
    workspace.delete("support_desk")
    workspace.seed()
    assert {s.id for s in workspace.list_graphs()} == {"research_brief"}


def test_a_graph_survives_a_round_trip(workspace: Workspace, desk: AgentGraph) -> None:
    workspace.write(desk)
    assert workspace.read(desk.id) == desk


def test_reading_a_missing_graph_raises(workspace: Workspace) -> None:
    with pytest.raises(FileNotFoundError):
        workspace.read("absent")


def test_a_graph_id_cannot_escape_the_workspace(workspace: Workspace) -> None:
    assert workspace.graph_path("../escape").parent == workspace.graphs_dir


def test_an_empty_graph_id_is_rejected(workspace: Workspace) -> None:
    with pytest.raises(ValueError):
        workspace.graph_path("../..")


def test_deleting_a_missing_graph_is_quiet(workspace: Workspace) -> None:
    workspace.delete("absent")


def test_the_registry_is_written_on_first_read(tmp_path: Path) -> None:
    space = Workspace(tmp_path / "w")
    assert not space.models_path.exists()
    assert [m.id for m in space.models()] == [m.id for m in DEFAULT_MODELS]
    assert space.models_path.exists()


def test_edited_rates_survive(workspace: Workspace) -> None:
    models = workspace.models()
    models[0].input_usd_per_mtok = 42.0
    workspace.write_models(models)
    assert workspace.models()[0].input_usd_per_mtok == 42.0


def test_a_model_added_to_the_defaults_reaches_an_existing_workspace(
    workspace: Workspace,
) -> None:
    trimmed = workspace.models()[:2]
    workspace.write_models(trimmed)
    assert len(workspace.models()) == len(DEFAULT_MODELS)


def test_an_edited_rate_survives_a_new_default_arriving(workspace: Workspace) -> None:
    models = workspace.models()
    models[0].input_usd_per_mtok = 42.0
    workspace.write_models(models[:3])
    refreshed = workspace.models()
    assert refreshed[0].input_usd_per_mtok == 42.0
    assert len(refreshed) == len(DEFAULT_MODELS)

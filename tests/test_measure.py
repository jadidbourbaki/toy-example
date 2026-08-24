from __future__ import annotations

import pytest

from sketch import measure
from sketch.estimate import estimate
from sketch.graph import AgentGraph
from sketch.measure import (
    JudgePass,
    Measurement,
    PatchMeasurement,
    SampleRun,
    plan,
    summarize,
)
from sketch.models import ModelSpec
from sketch.optimizer import Patch, apply_patch
from tests.conftest import cheapest, dearest


def run(request: str, usd: float, ms: int = 100, error: str = "") -> SampleRun:
    return SampleRun(request=request, output=f"answer to {request}", usd=usd, ms=ms, error=error)


def patch(op: str, **fields: object) -> Patch:
    return Patch.model_validate({"title": op, "rationale": "because", "op": op, **fields})


def test_summarize_averages_only_the_runs_that_finished() -> None:
    measurement = summarize([run("a", 1.0), run("b", 3.0), run("c", 99.0, error="boom")])
    assert measurement.usd == 2.0
    assert measurement.n == 2
    assert measurement.failures == 1


def test_summarize_reports_the_spread() -> None:
    assert summarize([run("a", 1.0), run("b", 3.0)]).usd_spread == 2.0


def test_summarize_of_one_run_has_no_spread() -> None:
    assert summarize([run("a", 1.0)]).usd_spread == 0.0


def test_summarize_of_nothing_is_empty() -> None:
    measurement = summarize([])
    assert measurement.usd == 0.0
    assert measurement.n == 0


def test_a_measurement_with_no_pairs_is_not_usable() -> None:
    measured = PatchMeasurement(
        patch_id="p", title="t", candidate=Measurement(), paired=0, error="everything failed"
    )
    assert measured.usable is False


def test_a_measurement_with_pairs_is_usable() -> None:
    measured = PatchMeasurement(patch_id="p", title="t", candidate=Measurement(), paired=2)
    assert measured.usable is True


def test_more_losses_than_wins_counts_as_a_regression() -> None:
    measured = PatchMeasurement(
        patch_id="p", title="t", candidate=Measurement(), paired=3, wins=1, losses=2
    )
    assert measured.regressed is True


def test_plan_counts_a_run_per_request_per_version(
    brief: AgentGraph, models: list[ModelSpec]
) -> None:
    patches = [patch("set_model", node_id="n4", model="haiku")]
    projection = plan(brief, patches, ["one", "two"], models)
    assert projection.graph_runs == 2 * (1 + 1)
    assert projection.judgements == 2 * 1 * 2
    assert projection.sample_size == 2


def test_plan_prices_a_cheaper_candidate_below_the_baseline(
    brief: AgentGraph, models: list[ModelSpec]
) -> None:
    dearer = plan(brief, [patch("set_model", node_id="n3", model=dearest(models))], ["one"], models)
    cheaper = plan(
        brief, [patch("set_model", node_id="n3", model=cheapest(models))], ["one"], models
    )
    assert cheaper.projected_usd < dearer.projected_usd


def test_plan_of_nothing_costs_nothing(brief: AgentGraph, models: list[ModelSpec]) -> None:
    assert plan(brief, [], [], models).projected_usd == 0.0


@pytest.mark.parametrize(
    ("forward", "reverse", "winner", "agreed"),
    [
        # forward shows baseline as A, reverse shows candidate as A.
        ("A", "B", "baseline", True),
        ("B", "A", "candidate", True),
        ("tie", "tie", "tie", True),
        # The judge picked whatever sat in the A slot both times, which is a
        # position preference rather than a quality difference.
        ("A", "A", "tie", False),
        ("B", "B", "tie", False),
        ("A", "tie", "tie", False),
    ],
)
async def test_a_verdict_stands_only_when_both_orderings_agree(
    monkeypatch: pytest.MonkeyPatch, forward: str, reverse: str, winner: str, agreed: bool
) -> None:
    passes = iter(
        [JudgePass(winner=forward, reason="first"), JudgePass(winner=reverse, reason="second")]
    )

    async def fake_pass(request: str, first: str, second: str) -> JudgePass:
        return next(passes)

    monkeypatch.setattr(measure, "_judge_pass", fake_pass)
    verdict = await measure.judge("q", "baseline answer", "candidate answer")
    assert verdict.winner == winner
    assert verdict.agreed is agreed


async def test_a_split_verdict_keeps_the_reason_from_the_first_pass(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    passes = iter([JudgePass(winner="A", reason="shorter"), JudgePass(winner="A", reason="longer")])

    async def fake_pass(request: str, first: str, second: str) -> JudgePass:
        return next(passes)

    monkeypatch.setattr(measure, "_judge_pass", fake_pass)
    assert (await measure.judge("q", "b", "c")).reason == "shorter"


def test_plan_includes_what_the_judge_costs(brief: AgentGraph, models: list[ModelSpec]) -> None:
    """The judge runs twice per request per candidate, and leaving it out of the
    projection would understate a measurement before anyone agrees to pay for
    it."""

    patches = [patch("set_model", node_id="n4", model=cheapest(models))]
    runs_only = sum(
        len(["one"]) * e.usd
        for e in [estimate(brief, models), estimate(apply_patch(brief, patches[0]), models)]
    )
    projected = plan(brief, patches, ["one"], models).projected_usd
    assert projected > runs_only

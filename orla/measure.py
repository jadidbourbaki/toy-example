"""Measure what a change to a graph actually does.

The static estimate in `sketch.estimate` prices prompt size. It is right
about a model swap and about an iteration cap, and it is blind to a prompt
rewrite whose saving lands in the output tokens of a later stage. Measuring
answers the question the estimate cannot.

Cost on its own would make this worse rather than better. Every candidate
that moves a stage to a cheaper model wins on measured cost by
construction, so a ranking built on cost alone converges on the advice to
serve everything with the cheapest model available. A quality signal sits
next to the cost signal to stop that.

The quality signal here is a pairwise judge. It sees the baseline output
and the candidate output for one request without being told which is
which, and it is asked twice with the two swapped. A winner is called only
when both passes agree, which is what keeps a position preference from
reading as a quality difference. A private deployment replaces the judge
with the client's own benchmark and nothing else about this module changes.
"""

from __future__ import annotations

import asyncio
import statistics
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, Field
from pydantic_ai import Agent

from orla.estimate import estimate
from orla.graph import AgentGraph
from orla.models import ModelSpec, by_id, driver_model
from orla.optimizer import Patch, apply_patch
from orla.runner import run_graph
from orla.settings import settings

# What one pairwise judgement costs, in tokens. Two answers and a request go
# in, a verdict and a sentence come out.
JUDGE_INPUT_TOKENS = 1500
JUDGE_OUTPUT_TOKENS = 120
JUDGE_PASSES = 2

Winner = Literal["baseline", "candidate", "tie"]


class SampleRun(BaseModel):
    """One request through one version of the graph."""

    request: str
    output: str = ""
    usd: float = 0.0
    ms: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    error: str = ""


class Measurement(BaseModel):
    """What a version of the graph did across the whole sample. usd and ms
    are means over the runs that finished, and spread is the gap between
    the cheapest and the dearest run, which is what says how much to trust
    the mean."""

    runs: list[SampleRun] = Field(default_factory=list)
    usd: float = 0.0
    ms: int = 0
    usd_spread: float = 0.0
    n: int = 0
    failures: int = 0


class Verdict(BaseModel):
    request: str
    winner: Winner
    reason: str = ""
    agreed: bool = True


class PatchMeasurement(BaseModel):
    """One candidate, measured.

    Every delta is paired. Both versions ran the same requests, and only the
    requests both versions completed count toward a delta, so a candidate that
    crashed on the expensive request cannot bank the cost it never paid. A
    candidate that completed nothing reports an error and no delta at all,
    because a broken graph is the cheapest graph there is.
    """

    patch_id: str
    title: str
    candidate: Measurement
    baseline_usd: float = 0.0
    usd_delta: float = 0.0
    ms_delta: int = 0
    paired: int = 0
    verdicts: list[Verdict] = Field(default_factory=list)
    wins: int = 0
    losses: int = 0
    ties: int = 0
    error: str = ""

    @property
    def usable(self) -> bool:
        return not self.error and self.paired > 0

    @property
    def regressed(self) -> bool:
        return self.losses > self.wins


class MeasurePlan(BaseModel):
    """What the run is about to do and what it is about to spend."""

    sample_size: int
    candidates: int
    graph_runs: int
    judgements: int
    projected_usd: float
    budget_usd: float


class MeasureEvent(BaseModel):
    type: Literal["plan", "run_done", "baseline_done", "patch_done", "done", "error"]
    plan: MeasurePlan | None = None
    label: str = ""
    request: str = ""
    baseline: Measurement | None = None
    patch: PatchMeasurement | None = None
    spent_usd: float = 0.0
    text: str = ""


class SampleProposal(BaseModel):
    requests: list[str] = Field(
        description="Short requests a real user would send this agent, one per line of the list."
    )


def summarize(runs: list[SampleRun]) -> Measurement:
    done = [run for run in runs if not run.error]
    costs = [run.usd for run in done]
    return Measurement(
        runs=runs,
        usd=round(statistics.fmean(costs), 6) if costs else 0.0,
        ms=int(statistics.fmean([run.ms for run in done])) if done else 0,
        usd_spread=round(max(costs) - min(costs), 6) if len(costs) > 1 else 0.0,
        n=len(done),
        failures=len(runs) - len(done),
    )


def plan(
    graph: AgentGraph,
    patches: list[Patch],
    sample: list[str],
    models: list[ModelSpec],
) -> MeasurePlan:
    """What the measurement will cost, from the static estimate. Predicting
    the cost of runs about to be made is the case the estimate is good at,
    and the measurement checks its work a minute later."""

    baseline_usd = estimate(graph, models).usd
    projected = len(sample) * baseline_usd
    for patch in patches:
        projected += len(sample) * estimate(apply_patch(graph, patch), models).usd

    judge_spec = by_id(models, settings.judge_model)
    if judge_spec is not None:
        per_judgement = (
            JUDGE_INPUT_TOKENS * judge_spec.input_usd_per_mtok
            + JUDGE_OUTPUT_TOKENS * judge_spec.output_usd_per_mtok
        ) / 1_000_000
        projected += len(sample) * len(patches) * JUDGE_PASSES * per_judgement

    return MeasurePlan(
        sample_size=len(sample),
        candidates=len(patches),
        graph_runs=len(sample) * (1 + len(patches)),
        judgements=len(sample) * len(patches) * JUDGE_PASSES,
        projected_usd=round(projected, 6),
        budget_usd=settings.measure_budget_usd,
    )


async def run_once(
    graph: AgentGraph,
    request: str,
    models: list[ModelSpec],
    root: Path,
    graphs: list[AgentGraph],
) -> SampleRun:
    """One request through the graph, reduced to what a comparison needs."""

    result = SampleRun(request=request)
    async for event in run_graph(graph, request, models, root, graphs):
        if event.type == "run_error":
            result.error = event.text
        elif event.type == "run_done" and event.depth == 0:
            result.output = event.text
            result.usd = event.usd
            result.ms = event.ms
            result.input_tokens = event.input_tokens
            result.output_tokens = event.output_tokens
    return result


JUDGE_INSTRUCTIONS = """
You compare two answers to the same request and say which one serves the person
who asked it better.

Judge on whether the answer is correct, whether it actually addresses what was
asked, and whether it is the right length for the question. A longer answer is
not a better answer. Ignore formatting differences that do not change what the
reader learns.

You are not told which system produced which answer, and the order carries no
information. Call it a tie when neither is clearly better.

Give the verdict and one sentence saying what decided it.
"""


class JudgePass(BaseModel):
    winner: Literal["A", "B", "tie"]
    reason: str = Field(description="One sentence on what decided it.")


async def _judge_pass(request: str, first: str, second: str) -> JudgePass:
    agent = Agent[None, JudgePass](
        driver_model(settings.judge_model),
        output_type=JudgePass,
        instructions=JUDGE_INSTRUCTIONS,
        model_settings={"max_tokens": 1024},
    )
    prompt = f"## The request\n\n{request}\n\n## Answer A\n\n{first}\n\n## Answer B\n\n{second}"
    return (await agent.run(prompt)).output


async def judge(request: str, baseline: str, candidate: str) -> Verdict:
    """A pairwise verdict, asked twice with the answers swapped. Disagreement
    between the two orderings means the judge was reading position rather
    than quality, so the request is scored a tie."""

    forward, reverse = await asyncio.gather(
        _judge_pass(request, baseline, candidate),
        _judge_pass(request, candidate, baseline),
    )

    first: Winner = (
        "baseline" if forward.winner == "A" else "candidate" if forward.winner == "B" else "tie"
    )
    second: Winner = (
        "candidate" if reverse.winner == "A" else "baseline" if reverse.winner == "B" else "tie"
    )

    agreed = first == second
    return Verdict(
        request=request,
        winner=first if agreed else "tie",
        reason=forward.reason,
        agreed=agreed,
    )


async def measure(
    graph: AgentGraph,
    patches: list[Patch],
    sample: list[str],
    models: list[ModelSpec],
    root: Path,
    graphs: list[AgentGraph],
) -> AsyncIterator[MeasureEvent]:
    """Run the baseline and every candidate over the sample, judge each pair,
    and report as results land."""

    if not sample:
        yield MeasureEvent(
            type="error", text="The sample is empty. Add a request to measure against."
        )
        return
    if not patches:
        yield MeasureEvent(type="error", text="Pick at least one proposal to measure.")
        return

    projection = plan(graph, patches, sample, models)
    yield MeasureEvent(type="plan", plan=projection)

    if projection.projected_usd > projection.budget_usd:
        yield MeasureEvent(
            type="error",
            text=(
                f"The run projects ${projection.projected_usd:.2f}, over the "
                f"${projection.budget_usd:.2f} cap. Shorten the sample, pick fewer "
                f"proposals, or raise ORLA_MEASURE_BUDGET_USD."
            ),
        )
        return

    limit = asyncio.Semaphore(max(1, settings.measure_concurrency))
    spent = 0.0

    async def guarded(target: AgentGraph, request: str) -> SampleRun:
        async with limit:
            return await run_once(target, request, models, root, graphs)

    baseline_runs = await asyncio.gather(*(guarded(graph, request) for request in sample))
    baseline = summarize(list(baseline_runs))
    spent += sum(run.usd for run in baseline_runs)
    yield MeasureEvent(type="baseline_done", baseline=baseline, spent_usd=round(spent, 6))

    if baseline.n == 0:
        yield MeasureEvent(
            type="error", text="Every baseline run failed, so there is nothing to compare against."
        )
        return

    baseline_by_request = {run.request: run for run in baseline_runs}

    async def measure_one(patch: Patch) -> PatchMeasurement:
        candidate_graph = apply_patch(graph, patch)
        runs = list(
            await asyncio.gather(*(guarded(candidate_graph, request) for request in sample))
        )
        candidate = summarize(runs)

        pairs = [
            (baseline_by_request[run.request], run)
            for run in runs
            if not run.error and not baseline_by_request[run.request].error
        ]

        measured = PatchMeasurement(
            patch_id=patch.id or patch.title,
            title=patch.title,
            candidate=candidate,
            paired=len(pairs),
        )

        if not pairs:
            failure = next((run.error for run in runs if run.error), "")
            measured.error = (
                f"The candidate failed on every request, so there is nothing to compare. {failure}"
                if failure
                else "No request completed on both versions, so there is nothing to compare."
            )
            return measured

        measured.baseline_usd = round(statistics.fmean([before.usd for before, _ in pairs]), 6)
        measured.usd_delta = round(
            statistics.fmean([after.usd - before.usd for before, after in pairs]), 6
        )
        measured.ms_delta = int(statistics.fmean([after.ms - before.ms for before, after in pairs]))

        verdicts = list(
            await asyncio.gather(
                *(judge(after.request, before.output, after.output) for before, after in pairs)
            )
        )
        measured.verdicts = verdicts
        measured.wins = sum(1 for v in verdicts if v.winner == "candidate")
        measured.losses = sum(1 for v in verdicts if v.winner == "baseline")
        measured.ties = sum(1 for v in verdicts if v.winner == "tie")

        if candidate.failures:
            measured.error = (
                f"{candidate.failures} of {len(runs)} requests failed on the candidate. "
                f"The deltas cover the {len(pairs)} that both versions completed."
            )
        return measured

    tasks = [asyncio.create_task(measure_one(patch)) for patch in patches]
    for finished in asyncio.as_completed(tasks):
        measurement = await finished
        spent += sum(run.usd for run in measurement.candidate.runs)
        yield MeasureEvent(type="patch_done", patch=measurement, spent_usd=round(spent, 6))

    yield MeasureEvent(type="done", spent_usd=round(spent, 6), baseline=baseline)


SAMPLE_INSTRUCTIONS = """
You write the sample of requests an agent is measured against.

A sample decides what a measured result means, so it has to look like the
traffic the agent will really see. Cover the ordinary case, the case that
needs the agent's hardest stage, and one request that is close to the edge of
what the agent is for.

Write each request the way a person would type it. No preamble, no framing, no
numbering. Keep each one under about thirty words.
"""


async def propose_sample(graph: AgentGraph, count: int = 3) -> list[str]:
    """A starting sample, written from what the graph says it does. The point
    is to give someone something to edit rather than a blank field."""

    agent = Agent[None, SampleProposal](
        driver_model(settings.compiler_model),
        output_type=SampleProposal,
        instructions=SAMPLE_INSTRUCTIONS,
        model_settings={"max_tokens": 2048},
    )
    entry = next((n for n in graph.nodes if n.config.kind == "input"), None)
    receives = getattr(entry.config, "description", "") if entry else ""
    stages = ", ".join(
        f"{n.name} ({n.config.kind})"
        for n in graph.nodes
        if n.config.kind not in ("input", "output")
    )

    prompt = (
        f"Write {count} requests for this agent.\n\n"
        f"Name: {graph.name}\n"
        f"What it does: {graph.description or 'not stated'}\n"
        f"What it receives: {receives or 'not stated'}\n"
        f"Its stages: {stages}"
    )
    return (await agent.run(prompt)).output.requests[:count]

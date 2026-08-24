"""The command line: serve the app, and drive each stage headlessly."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Annotated

import typer
import uvicorn
from rich.console import Console
from rich.table import Table

from sketch import apiref, compiler, measure, optimizer, server
from sketch.estimate import estimate
from sketch.graph import validate_graph
from sketch.runner import run_graph
from sketch.settings import settings
from sketch.store import Workspace

app = typer.Typer(
    add_completion=False, help="Sketch an agent graph, compile it, run it, improve it."
)
console = Console()


def _workspace() -> Workspace:
    workspace = Workspace(settings.workspace)
    workspace.seed()
    return workspace


@app.command()
def serve(
    host: Annotated[str, typer.Option(help="Interface to bind.")] = "",
    port: Annotated[int, typer.Option(help="Port to bind.")] = 0,
    reload: Annotated[bool, typer.Option(help="Restart on a source change.")] = False,
) -> None:
    """Run the API and serve the built frontend from the same process."""

    _workspace()
    uvicorn.run(
        "sketch.server:app",
        host=host or settings.host,
        port=port or settings.port,
        reload=reload,
    )


@app.command(name="list")
def list_graphs() -> None:
    """The graphs in the workspace."""

    table = Table("id", "name", "nodes", "edges", "description")
    for summary in _workspace().list_graphs():
        table.add_row(
            summary.id, summary.name, str(summary.nodes), str(summary.edges), summary.description
        )
    console.print(table)


@app.command()
def check(graph_id: str) -> None:
    """Validate a graph and price one request through it."""

    workspace = _workspace()
    graph = workspace.read(graph_id)
    problems = validate_graph(graph, {g.id for g in workspace.all_graphs()})
    for problem in problems:
        colour = "red" if problem.severity == "error" else "yellow"
        where = f" [{problem.node_id}]" if problem.node_id else ""
        console.print(f"[{colour}]{problem.severity}[/{colour}]{where} {problem.message}")
    if not problems:
        console.print("[green]No problems.[/green]")

    priced = estimate(graph, workspace.models())
    console.print(
        f"\nEstimated ${priced.usd:.6f} per request, "
        f"{priced.input_tokens} input and {priced.output_tokens} output tokens."
    )


@app.command(name="compile")
def compile_command(
    graph_id: str,
    out: Annotated[
        Path | None, typer.Option(help="Write the module here instead of stdout.")
    ] = None,
) -> None:
    """Compile a graph into a pydantic-deep module."""

    workspace = _workspace()
    graph = workspace.read(graph_id)
    result = asyncio.run(compiler.compile_graph(graph, workspace.models(), workspace.all_graphs()))

    if not result.ok:
        for problem in result.problems:
            console.print(f"[red]{problem}[/red]")
        raise typer.Exit(code=1)

    if result.notes:
        console.print(f"[dim]{result.notes}[/dim]\n")
    if out:
        out.write_text(result.source, encoding="utf-8")
        console.print(f"Wrote {out} after {result.attempts} attempt(s).")
    else:
        print(result.source)


@app.command(name="run")
def run_command(graph_id: str, request: str) -> None:
    """Run a graph once and report each stage."""

    workspace = _workspace()
    graph = workspace.read(graph_id)

    async def drive() -> None:
        async for event in run_graph(
            graph, request, workspace.models(), workspace.root, workspace.all_graphs()
        ):
            indent = "  " * event.depth
            if event.type == "node_done" and event.kind not in ("input", "output"):
                console.print(
                    f"{indent}[green]{event.name}[/green] {event.kind} "
                    f"stage={event.stage or '-'} {event.ms}ms ${event.usd:.6f}"
                )
            elif event.type == "node_skipped":
                console.print(f"{indent}[dim]{event.name} skipped[/dim]")
            elif event.type == "run_error":
                console.print(f"{indent}[red]{event.name or 'run'}: {event.text}[/red]")
            elif event.type == "run_done" and event.depth == 0:
                console.print(
                    f"\n[bold]{event.text}[/bold]\n\n"
                    f"[dim]{event.ms}ms, ${event.usd:.6f}, "
                    f"{event.input_tokens} in and {event.output_tokens} out[/dim]"
                )

    asyncio.run(drive())


@app.command(name="optimize")
def optimize_command(graph_id: str) -> None:
    """Propose changes to a graph and price each one."""

    workspace = _workspace()
    graph = workspace.read(graph_id)
    result = asyncio.run(optimizer.optimize(graph, workspace.models()))

    if not result.ok:
        console.print(f"[red]{result.error}[/red]")
        raise typer.Exit(code=1)

    console.print(f"{result.summary}\n")
    console.print(f"[dim]Baseline ${result.baseline_usd:.6f} per request[/dim]\n")
    for priced in result.patches:
        mark = "[green]+[/green]" if priced.applies else "[red]x[/red]"
        console.print(f"{mark} [bold]{priced.patch.title}[/bold]  ${priced.usd_delta:+.6f}")
        console.print(f"  [dim]{priced.patch.op}[/dim] {priced.patch.rationale}")
        for problem in priced.problems:
            console.print(f"  [red]{problem}[/red]")


@app.command(name="sample")
def sample_command(
    graph_id: str,
    count: Annotated[int, typer.Option(help="How many requests to write.")] = 3,
    save: Annotated[bool, typer.Option(help="Write the sample onto the graph.")] = False,
) -> None:
    """Write a starting sample of requests for a graph."""

    workspace = _workspace()
    graph = workspace.read(graph_id)
    requests = asyncio.run(measure.propose_sample(graph, count))
    for request in requests:
        console.print(f"- {request}")
    if save:
        graph.sample = requests
        workspace.write(graph)
        console.print(f"\n[dim]Saved onto {graph_id}.[/dim]")


@app.command(name="measure")
def measure_command(
    graph_id: str,
    yes: Annotated[bool, typer.Option("--yes", help="Skip the spend confirmation.")] = False,
) -> None:
    """Measure every proposal the optimizer makes against the graph's sample."""

    workspace = _workspace()
    graph = workspace.read(graph_id)
    models = workspace.models()

    if not graph.sample:
        console.print("[red]The graph has no sample. Run `sketch sample` first.[/red]")
        raise typer.Exit(code=1)

    proposal = asyncio.run(optimizer.optimize(graph, models))
    if not proposal.ok:
        console.print(f"[red]{proposal.error}[/red]")
        raise typer.Exit(code=1)

    patches = [priced.patch for priced in proposal.patches if priced.applies]
    projection = measure.plan(graph, patches, graph.sample, models)
    console.print(
        f"{projection.graph_runs} graph runs and {projection.judgements} judgements, "
        f"projected ${projection.projected_usd:.4f}."
    )
    if not yes and not typer.confirm("Run it?"):
        raise typer.Exit()

    async def drive() -> None:
        async for event in measure.measure(
            graph, patches, graph.sample, models, workspace.root, workspace.all_graphs()
        ):
            if event.type == "baseline_done" and event.baseline:
                console.print(
                    f"\n[bold]baseline[/bold] ${event.baseline.usd:.6f} per request, "
                    f"{event.baseline.ms}ms, n={event.baseline.n}"
                )
            elif event.type == "patch_done" and event.patch:
                measured = event.patch
                mark = "[red]x[/red]" if measured.regressed else "[green]+[/green]"
                console.print(
                    f"{mark} [bold]{measured.title}[/bold]  "
                    f"${measured.usd_delta:+.6f}  {measured.ms_delta:+d}ms  "
                    f"{measured.wins}W {measured.losses}L {measured.ties}T"
                )
            elif event.type == "error":
                console.print(f"[red]{event.text}[/red]")
            elif event.type == "done":
                console.print(f"\n[dim]Spent ${event.spent_usd:.4f}.[/dim]")

    asyncio.run(drive())


@app.command()
def schema(
    out: Annotated[
        Path | None, typer.Option(help="Write the schema here instead of stdout.")
    ] = None,
) -> None:
    """The wire schema the frontend types are generated from."""

    document = server.schema_document()
    if out:
        out.write_text(document, encoding="utf-8")
        console.print(f"Wrote {out}.")
    else:
        print(document)


@app.command(name="api-ref")
def api_ref() -> None:
    """Regenerate the pydantic-deep reference the compiler prompt reads."""

    path = apiref.write()
    console.print(f"Wrote {path}.")


@app.command()
def health() -> None:
    """Whether the compiler and the optimizer can reach a model."""

    console.print(
        json.dumps(
            {
                "model_credentials": settings.has_model_credentials,
                "compiler_model": settings.compiler_model,
                "workspace": str(settings.workspace),
            },
            indent=2,
        )
    )

# sketch

Sketch an agent as a graph of stages, bind a model to each stage, and get
a runnable [pydantic-deep](https://github.com/vstorm-co/pydantic-deepagents)
module out of it. Run the graph and watch what each stage costs. Ask for
changes worth making and accept the ones you want.

The pitch in one line: an agent has a shape and a price, and both should
be things you can see while you work.

## What is in here

**A canvas.** Stages are cards, and an arrow between two of them means the
second one reads the first one's output. Six kinds of stage cover most of
what an agent does: a single model call, a tool call, a ReAct loop, a
router that picks one branch and skips the rest, a subagent that runs
another graph in the workspace, and the two boundaries where the request
enters and the answer leaves.

**A model registry.** A stage names a model by an id rather than by a
provider string, so retargeting a stage is a one word change. The rates in
the registry drive the cost estimate, and you can edit them.

**A compiler.** A model writes the pydantic-deep module and the result is
checked before you see it. Generated source has to parse, pass pyflakes,
define the graph's entry function, and route every model call through a
`STAGES` table that names a model for each stage. A failure goes back to
the model once with the problem quoted. The file that comes out runs on
its own.

**A runner.** Execute the graph and get a line per stage: what it
produced, how long it took, and what it spent. The canvas lights up as the
run moves through it.

**An optimizer.** A model proposes changes drawn from a closed set of
operations, and each one is priced by applying it alone to the graph and
re-estimating. Accept the ones you want and they land on the canvas.

## Stages

A stage is a label on a call that says what the call is for rather than
where it goes. Two nodes tagged `answer` share one model binding, and the
generated module puts that binding in one table at the top:

```python
STAGES: dict[str, str] = {
    "clarify": "haiku",
    "research": "sonnet",
    "answer": "sonnet",
}
```

Moving the research stage to a cheaper model is one line, and nothing else
in the module changes. The stage tag is also the seam a routing layer
plugs into later, which is why every model call carries one.

## Running it

You need [uv](https://docs.astral.sh/uv/),
[pnpm](https://pnpm.io/), and [just](https://github.com/casey/just).

```bash
just install          # both toolchains
cp .env.example .env  # then put a key in it
just build            # generate types, build the frontend into the package
just serve            # http://127.0.0.1:8000
```

`ANTHROPIC_API_KEY` is what the compiler, the optimizer, and any graph
bound to a Claude model use. Editing the canvas, validating a graph, and
pricing one need no key at all.

For hot reload on both sides, `just dev` runs the API and the Vite dev
server together and proxies `/api` from one to the other.

## The command line

Every panel has a headless equivalent, which is the faster way to iterate
on a graph.

```bash
uv run sketch list                       # the graphs in the workspace
uv run sketch check research_brief       # validate one and price a request
uv run sketch compile research_brief     # write the module to stdout
uv run sketch run research_brief "how much chunk overlap?"
uv run sketch optimize research_brief    # proposals with a price on each
```

## The workspace

Graphs live as JSON files under `workspace/graphs/`, one per graph, next
to a `models.json` holding the registry. A workspace that fits in a
directory does not need a database, and a graph as a readable file can be
copied between workspaces or committed next to the code it generates.

Two examples are seeded on first run. `research_brief` is a linear
pipeline with a ReAct loop in the middle. `support_desk` routes an
incoming message to either a cheap direct answer or the research brief
agent, which makes it the example that exercises routers, subagents, and
tools at once.

## Tools

The tool catalog ships offline implementations, so a graph runs the moment
it is drawn without any credential beyond the model key. `search_notes`
reads a small built-in corpus, `calculator` evaluates arithmetic through
[simpleeval](https://github.com/danthedeckie/simpleeval), and `read_file`
is confined to the workspace directory. Replacing one with a real
integration is a change to a single function in `sketch/tools.py`.

## Layout

```
sketch/          the graph model, the compiler, the runner, the HTTP API
sketch/prompts/  prompt assets and the generated pydantic-deep reference
web/             the canvas and the panels around it
tests/           pytest suite
```

The two languages meet at one artifact. The Pydantic models in
`sketch/graph.py` are the single source of truth, and `just types`
generates the frontend's types from their JSON Schema. No TypeScript in
this repo restates a model, and CI fails if the committed types drift.

## Development

```bash
just check    # the read-only gate, both languages, the way CI runs it
just fmt      # ruff format and prettier
just types    # regenerate the frontend types after changing a model
just api-ref  # regenerate the pydantic-deep reference the compiler reads
```

The pydantic-deep API reference the compiler's prompt reads is extracted
from the installed package rather than written by hand, so a version bump
cannot leave the compiler working from a signature that no longer exists.

`AGENTS.md` carries the conventions this repo is written to.

## Licence

AGPL-3.0-or-later. See [LICENSE](LICENSE).

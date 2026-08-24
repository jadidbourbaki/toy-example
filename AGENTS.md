# AGENTS.md

Guidance for AI agents working on this repo. The CLAUDE.md symlink
resolves to this file. Read it top to bottom on first session.

## Project context

Sketch is a visual agent builder. You draw an agent as a graph of
stages, bind a model to each stage, and the builder compiles the graph
into runnable pydantic-deep code. An optimize pass proposes changes to
the graph and shows what each one costs.

The repo is two languages with one boundary between them. Python owns
the graph model, compilation, execution, and the HTTP API. TypeScript
owns the canvas and the panels around it. The boundary is JSON Schema:
the Pydantic models in `orla/graph.py` are the single source of truth,
and `just types` generates the TypeScript from them. Never hand-write a
TypeScript type that mirrors a Pydantic model.

## Repository layout

```
orla/          python package: graph model, compiler, runner, HTTP API
orla/prompts/  prompt assets and the pydantic-deep API reference
web/             vite + react frontend, the canvas and the panels
tests/           pytest suite
justfile         task runner
```

## Quality gate

`just check` runs the read-only gate the way CI does, across both
languages. If the gate does not pass locally, the work is not done.

- **Python** runs through the Astral toolchain under uv: `ruff format
  --check`, `ruff check`, `ty check`, and `pytest`.
- **TypeScript** runs `prettier --check`, `eslint`, and `tsc --noEmit`.
  TypeScript is pinned to the 6.x line because typescript-eslint does not
  support the 7.0 compiler API yet. Move both together when it does.

## Don't reinvent the wheel

This is the rule that outranks the others. Before writing any
non-trivial logic, look for something already built. Search the
standard library first, then the dependencies already in
`pyproject.toml` or `package.json`, then the wider ecosystem. A mature
package is almost always more correct and better tested than a version
written under deadline, and every line not written is a line nobody has
to review, test, or maintain. Hand-rolling what a library already
solves does not just cost the lines. It adds a design of our own that
we then own forever.

Judge a candidate dependency by its maintenance and adoption. Recent
releases, responsive maintainers, wide use in serious projects, and a
focused scope are the signals that matter. Stars and download counts
are hints rather than verdicts. A good dependency is welcome. Reinvent
only when nothing fits, or when the dependency would weigh far more
than the problem it solves.

What this has already meant here, as worked examples:

- Graph ordering, cycle detection, and reachability come from
  `networkx`. We do not carry our own topological sort.
- The calculator tool evaluates through `simpleeval`. We do not carry
  our own expression evaluator.
- Token counts come from `tiktoken`. We do not divide character counts
  by four.
- Structural graph comparison comes from `deepdiff`.
- Server-sent events come from `sse-starlette`.
- The canvas is `@xyflow/react` and accessible primitives are Radix.
  We do not hand-roll a node editor, a dialog, or a tab strip.
- Server-sent events are parsed by `eventsource-parser`.
- The frontend's types are generated from the Pydantic models by
  `json-schema-to-typescript`. No TypeScript here restates a model.

## Compilation is a model's job

The graph compiler asks a model to write the pydantic-deep module. It
does not assemble source from string templates. A template can only
ever reach the slice of the pydantic-deep API somebody hardcoded, and
that library is wide: subagents, skills, capabilities, output styles,
hooks, backends, and interrupts.

What replaces determinism is validation. Generated source must parse,
pass `ruff check`, define the graph's entry function, and route every
model call through a `STAGES` table that names a model for each stage.
A failure feeds the error back for one retry. Enforce invariants with
checks rather than by narrowing what the model is allowed to write.

## Measuring beats estimating, and cost alone beats nothing

`orla/estimate.py` prices prompt size. It is right about a model swap and
about an iteration cap, and it is blind to a prompt rewrite whose saving
lands in a later stage's output tokens. Keep it for the canvas, where it is
instant and free, and for predicting what a measurement is about to spend.

`orla/measure.py` runs the thing. Two rules hold there and are worth
restating before changing it.

Cost never travels alone. Every candidate that moves a stage to a cheaper
model wins on measured cost by construction, so a ranking built on cost alone
converges on the advice to serve everything with the cheapest model
available. A quality signal sits beside it.

Every delta is paired. Only the requests both versions completed count toward
a delta. A candidate that crashed on the expensive request would otherwise
bank the cost it never paid and report the failure as the largest saving on
the page.

## Stages

A stage is a label on a call that says what the call is for. Two nodes
on the same stage share one model binding, and changing that binding is
a one line edit in the generated module. Keep the stage tag on every
model call in both the runner and the generated code. It is the seam
that lets a graph be retargeted without editing the graph.

## Writing prose

These rules apply to all prose in the repo: README, docs, design notes,
code comments, and commit message bodies.

### Hard rules

- **No em-dashes.** The character does not appear in prose. Split into
  two sentences or use a comma. The same goes for en-dashes.
- **No semicolons in prose.** Use a period and start a new sentence.
- **No unnecessary parentheses.** A parenthetical aside that pauses the
  reader for a thought that could stand on its own belongs in its own
  sentence. Parens are fine for a genuine clarification such as an
  abbreviation on first use.
- **No ASCII diagrams.** Describe relationships in prose. A single
  inline arrow like `plan -> answer` is fine. Boxes and arrows are not.
- **No emoji** unless the user explicitly asks for them.
- **No vague back-references.** Do not open a sentence with "This",
  "That", "These", "Those", "Their", or "It" pointing at a noun from an
  earlier sentence. Name the noun again. "This is the wrong test"
  becomes "HealthBench is the wrong test."
- **State behavior positively.** Say what the code does rather than
  contrasting it against what it does not do.

### Soft rules

- Write short, direct sentences. If a sentence has more than one comma,
  consider whether it should be two sentences.
- Lead with the noun rather than the qualifier. "The compiler reads the
  graph" beats "When a graph is saved, the compiler reads it."
- Define jargon on first use, even when you think the reader knows it.
- Do not write in fragments or in a punchy, aphoristic style. Short
  clipped clauses strung together read like a parable rather than like
  documentation.
- Cut filler. Remove words that earn nothing.

## Writing comments

The prose rules apply, plus:

- **Default to writing no comment.** A well-named identifier and a
  short function explain themselves. Comment only when the why is
  non-obvious: a hidden constraint, a subtle invariant, a workaround for
  an upstream bug, behavior that would surprise a reader.
- **Don't describe what the code does.** The code does that.
- **Say what is done and why.** Frame a comment around the present
  behavior and its reason. Name the road taken.
- **Don't reference the past.** "Renamed from X" and "formerly Y" rot.
- **Don't reference callers or PRs.** They rot as the code evolves.
- **No multi-line comment banners.** One short comment per declaration.

## Python style

### Tooling

The toolchain is Astral's, and it is not optional.

- **uv** for environments and dependencies. Use `uv add`, `uv lock`,
  `uv run`. Not pip, not poetry, not a bare `requirements.txt`.
- **ruff** for linting and formatting. It replaces black, isort, and
  flake8.
- **ty** for type checking. It is the house checker. Not mypy or
  pyright.
- **just** for task running.

Pin every direct dependency to an exact version with `==` and commit
`uv.lock`. Dev tools go in `[dependency-groups].dev` per PEP 735.

### Types

Type every function signature, parameters and return. `ty check` runs
in the gate, so an untyped surface is a failing build.

- Put `from __future__ import annotations` at the top of every module.
- Use built-in generics, `list[int]` and `dict[str, T]`. Use `X | None`
  rather than `Optional[X]`.
- Model structured data that crosses a boundary with a Pydantic model.
  A signature like `list[dict[str, Any]]` is the warning sign. The rows
  have a shape, so give the shape a model and the signature its name.

### Imports

Every import goes at the top of the module. A function-level import
hides a dependency from the reader and the tooling, and it defers an
ImportError from startup to call time. Import inside a function only to
break a genuine circular import or to keep an optional dependency
optional, and name the reason in a comment.

### Naming and errors

- `snake_case` for functions and variables, `PascalCase` for classes,
  `UPPER_SNAKE` for module constants. A leading underscore marks a name
  module-private. PEP 8 wins on acronyms: `HTTPClient` as a class, and
  `url` and `id` lowercase.
- Raise exceptions rather than returning sentinel values to signal
  failure.
- Catch narrowly. A broad `except Exception` belongs only at a
  top-level boundary where you log and carry on. A bare `except:` is
  never correct. Use `raise ... from err` to preserve the cause.

## TypeScript style

The frontend is Vite, React, and TypeScript. The same instincts apply
as on the Python side: type everything, fail loudly, prefer what the
ecosystem already built, and let the tooling enforce the rest.

### Tooling and dependencies

- **pnpm** for dependencies. Commit `pnpm-lock.yaml`.
- **vite** for the dev server and the build.
- **eslint** with `typescript-eslint` for linting, **prettier** for
  formatting. Prettier owns formatting, and eslint rules that overlap
  with it stay off.
- **vitest** for tests when a unit is worth testing on its own.

Pin direct dependencies to exact versions, matching the Python side.

### Types

- `strict` is on in `tsconfig.json`, and it stays on. `noUncheckedIndexedAccess`
  is on as well.
- **Never write `any`.** Use `unknown` at a boundary and narrow it. An
  `any` disables the checker for everything it touches.
- Do not write a type that mirrors a Pydantic model. Run `just types`
  and import from the generated module. A hand-written mirror drifts.
- Prefer `type` aliases for unions and object shapes. Use `interface`
  when a type is meant to be extended or merged.
- Avoid enums. A union of string literals is simpler and erases at
  compile time.
- Do not assert with `as` to silence the checker. An assertion is a
  claim the checker cannot verify, so it needs a comment saying why the
  claim holds.

### Components

- Function components only. No classes.
- One component per file, named the same as the file.
- Props get a named exported type. Destructure them in the signature.
- Keep a component's body under roughly a hundred lines. Past that,
  pull the logic into a hook and leave the markup behind.
- Derive state rather than syncing it. A `useEffect` that copies one
  piece of state into another is almost always a computed value in
  disguise.
- Reach for `useEffect` only for genuine outside-React work:
  subscriptions, timers, and imperative library handles. Fetching on
  mount is a data-layer concern.

### State

- Canvas state lives in the `@xyflow/react` store. Do not mirror nodes
  and edges into a second store.
- Application state that outlives a component goes in a Zustand store,
  one store per concern, with selectors so a component subscribes to the
  slice it reads.
- Server state is not application state. Fetch it, cache it, and let the
  data layer own its freshness.

### Styling

Tailwind utility classes in the markup, with Radix primitives for
anything that has a standard shape and real accessibility requirements:
dialogs, popovers, tabs, tooltips, selects. Radix ships the behaviour
and the keyboard handling unstyled, and Tailwind supplies the look.
Write a bespoke component only when no primitive fits. Use `clsx` and
`tailwind-merge` to compose class names.

Design tokens live in the Tailwind theme. A raw hex value in a
component is a token that has not been named yet.

## Writing tests

Test the happy path for every exported function, every validation branch
that returns an error, and boundary cases for numeric inputs. Test the
fakes themselves. A silently broken fake hides regressions.

**Python.** Use `pytest`. Parametrize with `@pytest.mark.parametrize`
for several cases of the same shape, standalone `test_<scenario>`
functions otherwise. Prefer plain `assert`. Use hand-written fakes over
mock libraries where practical, and `monkeypatch` for network-shaped
dependencies. A test must never call a real model. The compiler and
optimizer tests use a recorded or stubbed model.

**TypeScript.** Use `vitest`. Test pure functions and hooks directly.
The canvas itself is exercised by hand rather than through a rendering
harness.

## Commit messages

Conventional commits, one sentence each, no body unless necessary.

```
feat: add a router node to the canvas palette
fix: reject a subagent edge that points at the graph itself
docs: describe the stage binding table in the readme
chore: pin pydantic-deep to 0.3.43
```

Rules:

- One sentence subject. Pick a tense and be consistent.
- Lowercase the type and the first word after the colon, unless it is a
  proper noun or an acronym.
- No commit body unless the reason cannot fit in the subject. No "Test
  plan" or "Summary" boilerplate.
- **No AI attribution trailer.** Ever, even when commits are authorized
  in advance.
- Do not amend or rewrite published commits without explicit consent.
  Force-push only with `--force-with-lease`, only on a feature branch,
  and only after confirming.

## Git practices

- Use whatever git identity the user has configured. Never pass
  `-c user.email` or `-c user.name`.
- Don't push without explicit authorization. Ask before every commit and
  every push, each time, even after a prior yes.
- `develop` is the working branch. `main` carries released state.
- Before any destructive operation, confirm. Use `--force-with-lease`.

## Working with the user

### Risk and reversibility

Local, reversible actions such as editing a file or running a test need
no preamble. Hard-to-reverse actions such as a force-push or a deleted
branch need explicit confirmation each time. Authorization for one
action does not extend to similar actions.

### Communication style

- Default to terse. The user reads diffs and can see what changed.
- Lead with the result, then the details if asked.
- One or two sentence end-of-turn summary: what shipped and what is
  next.
- Don't restate the request back. Don't open with "Great question."
- When you spot a side-effect the user did not ask for, name it and ask
  before doing it.

### Scope

Match the scope of your changes to what the user asked. A bug fix does
not get a free refactor. If a side-improvement is one line and zero
behavior change, do it. If it is more, surface it as a separate option
to opt into.

## When in doubt

Re-read this document, then the most recent changes that touched the
same area. The patterns are intentionally consistent. Match them rather
than introducing a new variation.

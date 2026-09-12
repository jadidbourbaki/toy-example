# Orla Dashboard

Sketch an agent as a graph of stages, bind a model to each stage, and get
a runnable [pydantic-deep](https://github.com/vstorm-co/pydantic-deepagents)
module out of it. Run the graph and watch what each stage costs. Ask for
changes worth making and accept the ones you want.

The pitch in one line: an agent has a shape and a price, and both should
be things you can see while you work.

## What is in here

**A canvas.** Stages are drawn as circles, and an arrow between two of them
means the second one reads the first one's output. Seven kinds of stage
cover most of what a workflow does. A **Prompt** asks a model one question.
An **Agent** gives a model tools and lets it work until it is done. A
**Tool** takes an action, such as sending an email or opening a ticket. A
**Branch** picks one path and skips the others. A **Judge** grades the stage
feeding it against criteria and sends the answer back for another try when
it falls short. An **Approve** pauses the run and shows a person what the
stage before it produced. Approving lets it through, a note sends it back
to the Prompt or Agent that wrote it, and declining stops everything after
it. A **Workflow** runs another saved workflow as a step. Start and End mark
where the request comes in and what goes back.

The stages sit in a toolbar over the canvas. Click one to add it or drag it
to where it should go. Double click a stage to edit it. A request goes in at
the foot of the canvas and the answer comes back above it. Code and
Optimizations live in a drawer under the canvas that opens from its tab
strip, the chat opens from the corner button, and every panel can be
dragged to the size you want. Every edit is saved as it is made.

The home screen is the workspace. Workflows lists what is saved, Templates
holds the patterns a new workflow can start from, Models is the registry,
and Settings shows what the server was started with.

**A model registry.** A stage names a model by an id rather than by a
provider string, so retargeting a stage is a one word change. The rates in
the registry drive the cost estimate, and you can edit them.

**A compiler.** A model writes the pydantic-deep module and the result is
checked before you see it. Generated source has to parse, pass pyflakes,
define the graph's entry function, and route every model call through a
`STAGES` table that names a model for each stage. A failure goes back to
the model once with the problem quoted. The file that comes out runs on
its own.

**A runner.** Send a request through the workflow. The running stage fills
with colour, each finished stage hangs what it produced under itself in a
bubble you can open, and the answer comes back above the request. Step
instead of Run pauses before every stage, draws the next one dashed, and
moves on one stage per click.

**An optimizer.** A model proposes changes drawn from a closed set of
operations, and each one is priced by applying it alone to the graph and
re-estimating. Accept the ones you want and they land on the canvas.

**An assistant.** The chat answers questions about the workflow you have
open. The chat is a pydantic-deep agent, the same harness an Agent stage
runs on, with read-only tools: the workflow, the estimate per stage, the model
registry, the validator, and a tool that prices one stage on another model
so "what would glm-5 on reply cost" gets a number rather than a guess. It
reads and never edits, because a helper that quietly rewrites a canvas is
hard to trust.

**A measurement.** The estimate prices prompt size, which is right about a
model swap and blind to a prompt rewrite whose saving lands downstream.
Measuring runs the baseline and each candidate over a sample of requests and
reports what each one really cost. It is worth knowing how often the estimate
and the measurement disagree, and the panel shows both.

## Why measuring needs a judge

Cost on its own would make the optimizer worse rather than better. Every
candidate that moves a stage to a cheaper model wins on measured cost by
construction, so a ranking built on cost alone converges on the advice to
serve everything with the cheapest model available.

So a quality signal sits next to the cost signal. A judge sees the baseline
answer and the candidate answer for one request without being told which is
which, and it is asked twice with the two swapped. A winner is called only
when both passes agree, which keeps a position preference from reading as a
quality difference. Each candidate reports a cost delta, a latency delta, and
a win, loss, and tie record.

Every delta is paired. Both versions run the same requests, and only the
requests both versions completed count toward a delta. Without pairing, a
candidate that crashed on the expensive request would bank the cost it never
paid and report the failure as the largest saving on the page.

A single run per request is noisy for a ReAct loop, since the number of tool
calls varies. The panel shows `n` and the spread rather than one confident
number.

## The sample

The sample is the set of requests a graph is measured against, and it is
stored on the graph so it travels with it. A model writes a first draft from
what the graph says it does, covering the ordinary case, the case that needs
the graph's hardest stage, and one request near the edge of what the graph is
for. Edit it, because the sample decides what a measured result means.

```bash
uv run orla sample research_brief --save
uv run orla measure research_brief
```

Measuring runs the graph once per request per candidate, so it costs real
money. `orla measure` prints its projection and asks before spending, the
panel puts the projection on the button, and a run that projects past
`ORLA_MEASURE_BUDGET_USD` refuses to start.

## Stages

A stage is a label on a call that says what the call is for rather than
where it goes. Two nodes tagged `answer` share one model binding, and the
generated module puts that binding in one table at the top:

```python
STAGES: dict[str, str] = {
    "classify": "glm-4.7-flash",
    "research": "qwen3-coder-30b",
    "reply": "nemotron-super-120b",
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

`AWS_BEARER_TOKEN_BEDROCK` is what every model call uses. Editing the
canvas, validating a graph, and pricing one need no key at all.

## Deploying a copy

`just deploy` puts a copy on an Amazon Lightsail container service, which
runs the image and hands back an HTTPS address with no load balancer, no
certificate, and no domain to arrange. You need Docker, credentials in the
AWS CLI, and the
[lightsailctl plugin](https://lightsail.aws.amazon.com/ls/docs/en_us/articles/amazon-lightsail-install-software)
that `push-container-image` uses, which on a Mac is
`brew install aws/tap/lightsailctl`.

```bash
cp .env.example .env   # the Bedrock token, and a password to guard the copy
just key               # a Bedrock key that only invokes models, good for 30 days
just deploy            # builds, pushes, deploys, prints the address
```

`just key` is worth running before the first deploy and again whenever the
key expires. It makes an IAM user that may invoke models and nothing else,
mints a credential that dies after thirty days, and writes it to `.env` as
`DEPLOY_BEDROCK_TOKEN`. A copy passed around by link then carries a
credential that can do less and lasts less long than the one on your laptop.

The same command creates the service the first time and rolls out a change
every time after. Every route sits behind HTTP Basic under the user name
`orla`, so the address is safe to send to a few people and to nobody else.
`just logs` says what the container has been saying. `just teardown` deletes
the service, which is everything a deployment costs.

Ten wrong passwords a minute from one caller is where the door stops
answering, counted by [limits](https://limits.readthedocs.io) against the
address the load balancer saw. A right password is never counted, so nobody
working in the app is throttled.

A password decides who gets in and says nothing about what they cost, and
behind it sit a chat, a compiler, and a measurement that all spend money on
someone's Bedrock bill. So a deployed copy also carries a spend cap, set by
`DEPLOY_SPEND_CAP_USD` and two hundred dollars by default. Every model call
anywhere in the app adds to one running total, and once the total passes the
cap the endpoints that drive a model refuse to start while drawing a
workflow and pricing one carry on. The total lives in the process, so
restarting the container starts the count again. Pair the cap with an AWS
budget alarm on the account, because the cap only knows about spending that
went through this app.

The workspace lives inside the container, so a workflow someone draws is
gone at the next deployment and the bundled templates come back in its
place. A demo is the only thing that arrangement suits. An EC2 instance with
a disk keeps the workspace, at the cost of arranging a domain and a
certificate.

A Micro service is ten dollars a month and free for the first three. The
model calls are billed separately, by Bedrock, against the token in the
deployment. Lightsail holds that token as a plain environment variable on
the service, so anyone who can read the account can read the token.

## Models

Every model in the registry is open weight and served by Amazon Bedrock. The
registry uses both of Bedrock's inference endpoints, because they carry
different catalogues. `bedrock-mantle` speaks the OpenAI protocol and carries
most of the current open-weight models. `bedrock-runtime` speaks the
AWS-native Converse API and carries models that never moved across, including
Llama 4 Maverick. A registry entry names which endpoint serves it, so adding
a model from either side is one row.

The ladder runs from Nemotron Nano 3 30B at $0.06 per million input tokens to
GLM 5 at $1.00, through GLM 4.7 Flash, Qwen3 Coder 30B, Nemotron Super 3 120B,
MiniMax M2.5, Qwen3 Coder 480B, and Kimi K2.5. Rates come from the AWS price
list. The ladder is deliberately not a straight line: Nemotron Super 120B
costs the same per input token as Qwen3 Coder 30B, and which model is cheapest
for a stage depends on whether that stage reads a lot or writes a lot.

Not every model can do everything. An Agent needs tool calling, and a Branch
or a Judge needs a typed result, so each entry records whether it has them.
Binding a model to a stage it cannot serve is reported on the canvas rather
than failing during a run.

Editing a rate or adding a model is a change to `DEFAULT_MODELS` in
`orla/models.py`, or an edit in the model picker. A model added to the
defaults later shows up in an existing workspace on the next read, and a rate
you edited there is kept.

For hot reload on both sides, `just dev` runs the API and the Vite dev
server together and proxies `/api` from one to the other.

## The command line

Every panel has a headless equivalent, which is the faster way to iterate
on a graph.

```bash
uv run orla list                         # the workflows in the workspace
uv run orla check customer_support       # validate one and price a request
uv run orla compile customer_support     # write the module to stdout
uv run orla run customer_support "Can I get a refund on a jacket I bought three weeks ago?"
uv run orla optimize customer_support    # proposals with a price on each
uv run orla sample customer_support      # write a sample to measure against
uv run orla measure customer_support     # measure every proposal against it
```

## The workspace

Graphs live as JSON files under `workspace/graphs/`, one per graph, next
to a `models.json` holding the registry. A workspace that fits in a
directory does not need a database, and a graph as a readable file can be
copied between workspaces or committed next to the code it generates.

One workflow is seeded on first run, and the templates page offers five
patterns, simplest first. `answer` is one Prompt. `research_brief` looks a
question up with a tool and writes the answer. `route` sorts a request into
one of two kinds. `review` drafts a reply, has a Judge check it, has a
person approve it, and sends it. `customer_support` is the full example: it
reads a customer message and branches. A policy question goes to an Agent
that searches the policy documents, then a Prompt that drafts the reply,
then a Judge that grades the draft and sends it back once if it falls
short, then a Tool that emails it. A problem a team has to act on goes to an
Agent that decides which team owns it and opens the ticket, which is the
handoff.

An Approve stage parks the run on a token until someone answers. The
browser answers from the bar above the canvas, `orla run` asks in the
terminal, and a generated module asks on the console unless the caller
passes its own `approve` function. A measurement runs with nobody watching,
so it lets every Approve through.

## Tools

The tool catalog ships offline implementations, so a workflow runs the
moment it is drawn without any credential beyond the model key.
`search_policies` reads a small built-in set of policy documents,
`create_ticket` and `send_email` return confirmations, `calculator`
evaluates arithmetic through
[simpleeval](https://github.com/danthedeckie/simpleeval), and `read_file`
is confined to the workspace directory. Replacing one with a real
integration is a change to a single function in `orla/tools.py`.

## Layout

```
orla/          the graph model, the compiler, the runner, the HTTP API
orla/prompts/  prompt assets and the generated pydantic-deep reference
web/             the canvas and the panels around it
tests/           pytest suite
```

The two languages meet at one artifact. The Pydantic models in
`orla/graph.py` are the single source of truth, and `just types`
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

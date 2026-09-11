"""Customer support

Read a customer message, draft an answer from the policy documents, have a
person approve it, and email it. A problem a team has to act on becomes a
ticket for that team.

Generated from a sketch graph. Every model call is tagged with the stage it
serves, and STAGES decides which model serves each stage, so retargeting a
stage is a one line edit.
"""

from __future__ import annotations

import asyncio
import itertools
import os
from collections.abc import Callable
from string import Template
from typing import Any, Literal

from pydantic import BaseModel
from pydantic_ai import Agent
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.usage import UsageLimits
from pydantic_deep import BASE_PROMPT, create_deep_agent, create_default_deps

MODELS: dict[str, str] = {
    "glm-4.7-flash": "zai.glm-4.7-flash",
    "nemotron-super-120b": "nvidia.nemotron-super-3-120b",
    "qwen3-coder-30b": "qwen.qwen3-coder-30b-a3b-instruct",
}

STAGES: dict[str, str] = {
    "classify": "glm-4.7-flash",
    "judge": "glm-4.7-flash",
    "reply": "nemotron-super-120b",
    "research": "qwen3-coder-30b",
    "triage": "glm-4.7-flash",
}

REGION = os.environ.get("AWS_REGION", "us-west-2")
BASE_URL = "https://bedrock-mantle." + REGION + ".api.aws/v1"


def model_for(stage: str) -> OpenAIChatModel | str:
    """The model serving a stage right now. A bedrock: prefix names the
    Converse API, and anything else is served by the mantle endpoint."""

    name = MODELS[STAGES[stage]]
    if name.startswith("bedrock:"):
        return name
    provider = OpenAIProvider(base_url=BASE_URL, api_key=os.environ["AWS_BEARER_TOKEN_BEDROCK"])
    return OpenAIChatModel(name, provider=provider)


def fill(template: str, values: dict[str, Any]) -> str:
    """Substitute ${name} references with the outputs upstream stages produced."""

    return Template(template).safe_substitute(values)


POLICIES: list[tuple[str, str]] = [
    (
        "refunds",
        "A full refund is available within 30 days of purchase. After 30 days, store credit only.",
    ),
    (
        "shipping",
        "Standard shipping takes 3 to 5 business days. Express shipping takes 1 to 2 and costs 12 dollars.",
    ),
    (
        "returns",
        "Items can be returned within 30 days if unused and in original packaging. Return shipping is free.",
    ),
]

_ticket_numbers = itertools.count(1042)


def search_policies(query: str) -> str:
    """Search the company policy documents and return the matching sections."""

    terms = [t for t in query.lower().split() if len(t) > 2]
    hits = [
        f"[{topic}] {body}"
        for topic, body in POLICIES
        if any(t in topic or t in body.lower() for t in terms)
    ]
    return "\n".join(hits) if hits else "No policy matched that query."


def create_ticket(team: str, summary: str) -> str:
    """Open an internal ticket for a team and return its number."""

    number = next(_ticket_numbers)
    return f"Ticket #{number} opened for the {team} team: {summary}"


def send_email(to: str, body: str) -> str:
    """Send an email to the customer and confirm what went out."""

    preview = body.strip().replace("\n", " ")[:90]
    return f"Sent to {to}: {preview}"


deps = create_default_deps()

ClassifyRoute = Literal["policy", "team"]

classify_agent = Agent(
    model_for("classify"),
    output_type=ClassifyRoute,
    instructions=(
        "Is this a question a policy answers, or a problem a team has to act on?\n\n"
        "Answer with exactly one label.\n"
        "- policy: A question answered by a policy: refunds, shipping, returns, account access, data, cancellation.\n"
        "- team: A problem a team has to act on: a bug, a billing error, an outage, a complaint."
    ),
)

# Only search_policies was drawn on this stage, so every other default
# capability of create_deep_agent is switched off explicitly.
research_agent = create_deep_agent(
    model=model_for("research"),
    instructions=(
        f"{BASE_PROMPT}\n\nSearch the policy documents before answering. Return the policy "
        "sections that apply, quoted, with their topic tags. Say plainly when no policy "
        "covers the question."
    ),
    tools=[search_policies],
    web_search=False,
    web_fetch=False,
    thinking=False,
    include_todo=False,
    include_filesystem=False,
    include_execute=False,
    include_subagents=False,
    include_skills=False,
    include_builtin_subagents=False,
    include_plan=False,
    include_memory=False,
)


class Verdict(BaseModel):
    passed: bool
    feedback: str = ""


class Decision(BaseModel):
    approved: bool = True
    note: str = ""


def approve_on_console(question: str, text: str) -> Decision:
    """The default way an approve stage asks: print the draft and read a line.
    A blank line approves, and anything typed sends the draft back as a note."""

    print(f"\n{question}\n\n{text}\n")
    note = input("Press enter to approve, or type a note to send it back: ").strip()
    return Decision(approved=not note, note=note)


judge_agent = Agent[None, Verdict](
    model_for("judge"),
    output_type=Verdict,
    instructions=(
        "You review one stage's output against the criteria. Pass it only when every "
        "criterion holds. When it fails, say what to change in two sentences."
    ),
)

JUDGE_CRITERIA = (
    "Answers the customer's question. Cites the policy in plain words. Four sentences at "
    "most. Promises nothing the policy findings do not support."
)

APPROVE_QUESTION = "Send this reply to the customer?"

reply_agent = Agent(
    model_for("reply"),
    instructions=(
        "Write the email a support agent would send. Four sentences at most, warm and "
        "direct, and cite the policy in plain words. Open with the answer."
    ),
)

route_to_team_agent = create_deep_agent(
    model=model_for("triage"),
    instructions=(
        f"{BASE_PROMPT}\n\nDecide which team owns this problem, then open one ticket for them "
        "with a one sentence summary. Teams: billing, engineering, shipping, accounts."
    ),
    tools=[create_ticket],
    web_search=False,
    web_fetch=False,
    thinking=False,
    include_todo=False,
    include_filesystem=False,
    include_execute=False,
    include_subagents=False,
    include_skills=False,
    include_builtin_subagents=False,
    include_plan=False,
    include_memory=False,
)


async def customer_support_run(
    request: str, approve: Callable[[str, str], Decision] = approve_on_console
) -> str:
    """Run Customer support once and return its output."""

    values: dict[str, Any] = {"input": request}

    route = (await classify_agent.run(fill("${input}", values))).output
    values["classify"] = route

    # The stages after the router run on one branch only, so the other branch
    # is skipped for this request.
    if route == "policy":
        research = await research_agent.run(
            fill("Find the policy that answers this customer: ${input}", values),
            deps=deps,
            usage_limits=UsageLimits(request_limit=6),
        )
        values["research"] = str(research.output)

        reply_prompt = fill("Customer message:\n${input}\n\nPolicy findings:\n${research}", values)
        values["reply"] = (await reply_agent.run(reply_prompt)).output

        # The judge grades the reply and sends it back once when it falls short.
        # Later stages read the surviving reply under the reply stage's own name.
        for _ in range(2):
            verdict = (
                await judge_agent.run(
                    f"Criteria:\n{JUDGE_CRITERIA}\n\nRequest:\n{request}\n\n"
                    f"Output to check:\n{values['reply']}"
                )
            ).output
            if verdict.passed:
                break
            revision = f"\n\nA reviewer rejected the previous answer: {verdict.feedback}\nAnswer again with that fixed."
            values["reply"] = (await reply_agent.run(reply_prompt + revision)).output
        values["judge"] = values["reply"]

        # A person sees the reply before it goes out. A note sends it back to
        # the reply stage and asks again, up to three asks in all.
        decision = approve(APPROVE_QUESTION, values["judge"])
        for _ in range(2):
            if decision.approved or not decision.note:
                break
            revision = f"\n\nA reviewer sent the previous answer back: {decision.note}\nAnswer again with that fixed."
            values["reply"] = (await reply_agent.run(reply_prompt + revision)).output
            values["judge"] = values["reply"]
            decision = approve(APPROVE_QUESTION, values["judge"])
        if not decision.approved:
            return "Declined at approve. Nothing after it ran."
        values["approve"] = values["judge"]

        values["email"] = send_email(
            to=fill("the customer", values), body=fill("${approve}", values)
        )
        return str(values["email"])

    triage = await route_to_team_agent.run(
        fill("${input}", values),
        deps=deps,
        usage_limits=UsageLimits(request_limit=5),
    )
    values["route_to_team"] = str(triage.output)
    return str(values["route_to_team"])


if __name__ == "__main__":
    import sys

    message = " ".join(sys.argv[1:]) or "Can I get a refund on something I bought last week?"
    print(asyncio.run(customer_support_run(message)))

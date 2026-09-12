"""What a deployed copy is allowed to spend.

A copy behind one shared password lets everyone holding the link spend money
through the chat, the compiler, and a measurement. The password decides who
gets in and says nothing about what they cost, so the ledger here is the
other half. Every model call adds to one running total, and the endpoints
that drive a model refuse to start once the total passes the cap. Drawing on
the canvas, validating a workflow, and pricing one carry on working, because
none of them call a model.

The total lives in the process, so restarting the container starts the count
again, and a request already in flight is never interrupted. A cap stops a
runaway loop rather than keeping accounts.
"""

from __future__ import annotations

from typing import Any

from orla.models import ModelSpec, by_id
from orla.settings import settings


def usage_of(result: Any) -> tuple[int, int]:
    """The input and output tokens one model call reported.

    pydantic-ai exposes run usage as a property on current versions and as a
    method on older ones. Accept either so a version bump does not silently
    stop charging a run."""

    usage = result.usage
    if callable(usage):
        usage = usage()
    return (
        int(getattr(usage, "input_tokens", 0) or 0),
        int(getattr(usage, "output_tokens", 0) or 0),
    )


class Ledger:
    def __init__(self) -> None:
        self.spent_usd = 0.0
        self.calls = 0

    def reset(self) -> None:
        self.spent_usd = 0.0
        self.calls = 0

    def charge(self, models: list[ModelSpec], model_id: str, result: Any) -> tuple[float, int, int]:
        """Record what one model call cost, and report the cost and the tokens."""

        input_tokens, output_tokens = usage_of(result)
        spec = by_id(models, model_id)
        usd = 0.0
        if spec is not None:
            usd = (
                input_tokens * spec.input_usd_per_mtok + output_tokens * spec.output_usd_per_mtok
            ) / 1_000_000
        self.spent_usd += usd
        self.calls += 1
        return round(usd, 6), input_tokens, output_tokens

    def refusal(self) -> str | None:
        """Why a model call must not start, or None when there is room left."""

        cap = settings.spend_cap_usd
        if cap <= 0 or self.spent_usd < cap:
            return None
        return (
            f"This copy has spent its ${cap:.2f} cap on model calls, so nothing "
            f"that drives a model will run. Drawing a workflow and pricing one "
            f"still work."
        )


LEDGER = Ledger()

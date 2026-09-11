"""Where a run waits for a person.

An Approve stage pauses the run and shows what the stage before it
produced. The runner parks on a token here, the browser or the terminal
answers against that token, and the run carries on. Everything lives in
one process, so an asyncio future per token is the whole mechanism.
"""

from __future__ import annotations

import asyncio
import uuid

from pydantic import BaseModel


class Decision(BaseModel):
    approved: bool = True
    note: str = ""


class Approvals:
    def __init__(self) -> None:
        self._waiting: dict[str, asyncio.Future[Decision]] = {}

    def open(self) -> str:
        token = uuid.uuid4().hex
        self._waiting[token] = asyncio.get_running_loop().create_future()
        return token

    async def wait(self, token: str, timeout: float) -> Decision:
        try:
            return await asyncio.wait_for(self._waiting[token], timeout)
        except TimeoutError:
            return Decision(approved=False, note="")
        finally:
            self._waiting.pop(token, None)

    def answer(self, token: str, decision: Decision) -> bool:
        future = self._waiting.get(token)
        if future is None or future.done():
            return False
        future.set_result(decision)
        return True


APPROVALS = Approvals()

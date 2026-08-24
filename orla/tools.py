"""Offline implementations of the tool catalog.

Every tool runs locally and needs no credentials, so a sketched graph is
runnable the moment it is drawn. Replacing one of these with a real
integration is a change to a single function.
"""

from __future__ import annotations

from collections.abc import Callable
from pathlib import Path

from simpleeval import SimpleEval

NOTES: list[tuple[str, str]] = [
    (
        "retrieval",
        "Chunk overlap above 20 percent mostly adds cost. Measure recall before raising it.",
    ),
    (
        "routing",
        "A classifier in front of two specialists beats one generalist when the classes are far apart.",
    ),
    ("caching", "Prompt caching pays off once the shared prefix passes roughly a thousand tokens."),
    (
        "evaluation",
        "An LLM judge drifts between model versions. Pin the judge model when you compare runs.",
    ),
    (
        "latency",
        "Parallel stages hide latency only when nothing downstream reads both of their outputs.",
    ),
    (
        "cost",
        "Output tokens usually dominate. Shortening the answer format beats shortening the prompt.",
    ),
]


def echo(text: str) -> str:
    """Return the text unchanged."""

    return text


def calculator(expression: str) -> str:
    """Evaluate an arithmetic expression."""

    evaluator = SimpleEval(functions={}, names={})
    try:
        return str(evaluator.eval(expression))
    except Exception as exc:
        return f"calculator error: {exc}"


def word_count(text: str) -> str:
    """Count words, characters, and lines."""

    return f"words={len(text.split())} characters={len(text)} lines={len(text.splitlines()) or 1}"


def search_notes(query: str) -> str:
    """Search the built-in corpus of engineering notes."""

    terms = [t for t in query.lower().split() if len(t) > 2]
    hits = [
        f"[{topic}] {body}"
        for topic, body in NOTES
        if any(t in topic or t in body.lower() for t in terms)
    ]
    return "\n".join(hits) if hits else "No notes matched that query."


def make_read_file(root: Path) -> Callable[[str], str]:
    """A file reader confined to root, so a graph cannot walk out of the
    workspace by asking for a parent directory."""

    def read_file(path: str) -> str:
        """Read a UTF-8 text file from the workspace directory."""

        resolved_root = root.resolve()
        target = (resolved_root / path).resolve()
        if not target.is_relative_to(resolved_root):
            return "read_file error: the path leaves the workspace directory."
        if not target.is_file():
            return f"read_file error: {path} is not a file in the workspace."
        return target.read_text(encoding="utf-8", errors="replace")[:20_000]

    return read_file


def registry(root: Path) -> dict[str, Callable[..., str]]:
    return {
        "echo": echo,
        "calculator": calculator,
        "word_count": word_count,
        "search_notes": search_notes,
        "read_file": make_read_file(root),
    }


def call(tool_id: str, arguments: dict[str, str], root: Path) -> str:
    fn = registry(root).get(tool_id)
    if fn is None:
        return f"unknown tool: {tool_id}"
    try:
        return fn(**arguments)
    except TypeError as exc:
        return f"{tool_id} error: {exc}"

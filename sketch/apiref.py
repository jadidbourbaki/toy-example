"""Extract the pydantic-deep API reference the compiler prompt reads.

The reference is generated from the installed package rather than
written by hand, so a version bump cannot leave the compiler working
from a signature that no longer exists.
"""

from __future__ import annotations

import enum
import inspect
from pathlib import Path
from typing import Any

import pydantic_deep

BUILDERS = ["create_deep_agent", "create_default_deps"]
TYPES = ["Hook", "OutputStyle", "Skill", "RuntimeConfig", "TeamMemberSpec", "SubAgentConfig"]
ENUMS = ["HookEvent"]

MAX_ANNOTATION = 90
MAX_DEFAULT = 40


def _shorten(text: str, limit: int) -> str:
    cleaned = text.replace("typing.", "").replace("pydantic_deep.", "")
    return cleaned if len(cleaned) <= limit else cleaned[: limit - 3] + "..."


def _signature(name: str) -> str | None:
    obj = getattr(pydantic_deep, name, None)
    if obj is None:
        return None
    try:
        signature = inspect.signature(obj)
    except (TypeError, ValueError):
        return None

    lines = [f"### `{name}`", "", "```python", f"def {name}("]
    for param_name, param in signature.parameters.items():
        annotation = ""
        if param.annotation is not inspect.Parameter.empty:
            annotation = f": {_shorten(str(param.annotation), MAX_ANNOTATION)}"
        default = ""
        if param.default is not inspect.Parameter.empty:
            default = f" = {_shorten(repr(param.default), MAX_DEFAULT)}"
        lines.append(f"    {param_name}{annotation}{default},")
    lines += [")", "```"]

    doc = inspect.getdoc(obj)
    if doc:
        lines += ["", doc.strip().split("\n\n")[0]]
    return "\n".join(lines)


def _fields(name: str) -> str | None:
    obj = getattr(pydantic_deep, name, None)
    if obj is None:
        return None

    annotations: dict[str, Any] = {}
    model_fields = getattr(obj, "model_fields", None)
    if model_fields:
        annotations = {k: v.annotation for k, v in model_fields.items()}
    elif hasattr(obj, "__annotations__"):
        annotations = dict(obj.__annotations__)
    if not annotations:
        return None

    lines = [f"### `{name}`", "", "```python"]
    for field, annotation in annotations.items():
        rendered = str(annotation)
        if hasattr(annotation, "__forward_arg__"):
            rendered = annotation.__forward_arg__
        lines.append(f"    {field}: {_shorten(rendered, MAX_ANNOTATION)}")
    lines.append("```")

    doc = inspect.getdoc(obj)
    if doc and not doc.startswith("!!!"):
        lines += ["", doc.strip().split("\n\n")[0]]
    return "\n".join(lines)


def render() -> str:
    sections = [
        "# pydantic-deep API reference",
        "",
        "Extracted from the installed pydantic-deep package. Regenerate with `just api-ref`.",
        "",
        "## Building an agent",
        "",
    ]
    for name in BUILDERS:
        rendered = _signature(name)
        if rendered:
            sections += [rendered, ""]

    sections += ["## Types the builder takes", ""]
    for name in TYPES:
        rendered = _fields(name) or _signature(name)
        if rendered:
            sections += [rendered, ""]

    sections += ["## Enumerations and constants", ""]
    for name in ENUMS:
        obj = getattr(pydantic_deep, name, None)
        if isinstance(obj, type) and issubclass(obj, enum.Enum):
            sections += [f"### `{name}`", "", "```python"]
            sections += [f"    {name}.{member.name}  # {member.value!r}" for member in obj]
            sections += ["```", ""]

    sections += [
        "`BASE_PROMPT` is the harness's own tool-usage instructions. Compose with it rather than replacing it:",
        "",
        "```python",
        'instructions=f"{BASE_PROMPT}\\n\\n{your_instructions}"',
        "```",
        "",
        "## Backends",
        "",
        "`LocalBackend()` runs filesystem and execute tools on the host. `DockerSandbox` isolates them. Execute tools stay off unless `include_execute=True`.",
        "",
    ]
    return "\n".join(sections)


def write(target: Path | None = None) -> Path:
    path = target or Path(__file__).resolve().parent / "prompts" / "pydantic_deep_api.md"
    path.write_text(render(), encoding="utf-8")
    return path

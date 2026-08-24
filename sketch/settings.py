"""Runtime configuration, read from the environment and the project .env.

Importing this module loads the project's .env into the process
environment. pydantic-ai reads provider credentials from os.environ
directly, so a key that only reached a settings object would not
authenticate anything.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent

load_dotenv(PROJECT_ROOT / ".env")


class Settings(BaseSettings):
    """The compiler and the optimizer both drive a model. compiler_model
    selects it, separate from the models a graph binds to its stages."""

    model_config = SettingsConfigDict(env_prefix="SKETCH_", extra="ignore")

    compiler_model: str = "anthropic:claude-opus-5"
    judge_model: str = "anthropic:claude-sonnet-5"
    # A measurement runs the graph once per sample request per candidate, so a
    # careless click on a large sample can spend real money. The run refuses to
    # start when its own projection passes this line.
    measure_budget_usd: float = 5.0
    # How many graph runs may be in flight at once. Higher finishes sooner and
    # is likelier to meet a provider rate limit.
    measure_concurrency: int = 4
    workspace: Path = PROJECT_ROOT / "workspace"
    host: str = "127.0.0.1"
    port: int = 8000

    @property
    def has_model_credentials(self) -> bool:
        return bool(os.environ.get("ANTHROPIC_API_KEY"))


settings = Settings()

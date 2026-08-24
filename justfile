# Task runner. `just check` is the gate CI runs.

default:
    @just --list

# Run the API and serve the built frontend from one process.
serve:
    uv run orla serve

# Run the API and the vite dev server together, with hot reload on both.
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill 0' EXIT
    uv run orla serve --reload &
    cd web && pnpm dev &
    wait

# Install both toolchains.
install:
    uv sync
    cd web && pnpm install

# Generate the frontend's types from the Pydantic models.
types:
    uv run orla schema --out web/src/types/schema.json
    cd web && pnpm run types

# Regenerate the pydantic-deep reference the compiler prompt reads.
api-ref:
    uv run orla api-ref

# Build the frontend into the package, so `serve` hosts it.
build: types
    cd web && pnpm build
    rm -rf orla/static
    cp -r web/dist orla/static

fmt:
    uv run ruff format orla tests
    cd web && pnpm run fmt

lint:
    uv run ruff check orla tests
    cd web && pnpm run lint

typecheck:
    uv run ty check orla
    cd web && pnpm run typecheck

test:
    uv run pytest -q

# The read-only gate, the way CI runs it.
check:
    uv run ruff format --check orla tests
    uv run ruff check orla tests
    uv run ty check orla
    uv run pytest -q
    cd web && pnpm run check

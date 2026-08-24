"""A static cost estimate for a graph.

The estimate exists so a proposed change carries a number before anyone
spends money to find out. Token counts come from a real tokenizer rather
than a characters-per-token guess, and the rates come from the model
registry, so the arithmetic is the only approximation left.

The tokenizer is OpenAI's cl100k_base, which is close enough across
model families for a comparison between two versions of the same graph.
A measured run replaces the estimate wherever a real number exists.
"""

from __future__ import annotations

from functools import lru_cache

import tiktoken
from pydantic import BaseModel

from sketch.graph import (
    AgentGraph,
    Node,
    ReactConfig,
    RouterConfig,
    templates_of,
    topological_order,
)
from sketch.models import ModelSpec, by_id

UPSTREAM_TOKENS = 400
ASSUMED_OUTPUT_TOKENS = 400
ROUTER_OUTPUT_TOKENS = 16


@lru_cache(maxsize=1)
def _encoding() -> tiktoken.Encoding:
    return tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_encoding().encode(text, disallowed_special=()))


class NodeEstimate(BaseModel):
    node_id: str
    name: str
    model: str
    calls: float
    input_tokens: int
    output_tokens: int
    usd: float


class GraphEstimate(BaseModel):
    """Per node and total cost for one request through the graph. A node
    behind a router is weighted by an even split across the router's
    routes, since a static estimate has no traffic to learn a real split
    from."""

    nodes: list[NodeEstimate]
    usd: float
    input_tokens: int
    output_tokens: int


def _prompt_tokens(node: Node) -> int:
    """What one call on this node sends. The written templates are
    counted exactly. Each upstream reference stands in for text the node
    has not produced yet, so it is charged a flat allowance."""

    written = sum(count_tokens(t) for t in templates_of(node))
    upstream = sum(1 for t in templates_of(node) if "$" in t) * UPSTREAM_TOKENS
    return written + upstream


def _branch_weights(graph: AgentGraph) -> dict[str, float]:
    """How often each node runs per request. A node behind a router with
    three routes runs a third of the time. Topological order means every
    source is settled before the nodes that read it."""

    order = topological_order(graph) or [n.id for n in graph.nodes]
    weights: dict[str, float] = {}

    for node_id in order:
        incoming = graph.incoming(node_id)
        if not incoming:
            weights[node_id] = 1.0
            continue
        total = 0.0
        for edge in incoming:
            source = graph.node(edge.source)
            if source is None:
                continue
            share = 1.0
            if isinstance(source.config, RouterConfig) and source.config.routes:
                share = 1.0 / len(source.config.routes)
            total += weights.get(source.id, 1.0) * share
        weights[node_id] = min(total, 1.0) or 1.0

    return weights


def estimate(graph: AgentGraph, models: list[ModelSpec]) -> GraphEstimate:
    weights = _branch_weights(graph)
    rows: list[NodeEstimate] = []

    for node in graph.nodes:
        spec = by_id(models, getattr(node.config, "model", ""))
        if spec is None:
            continue

        calls = weights.get(node.id, 1.0)
        if isinstance(node.config, ReactConfig):
            calls *= max(1, node.config.max_iterations) / 2

        per_call_out = (
            ROUTER_OUTPUT_TOKENS if isinstance(node.config, RouterConfig) else ASSUMED_OUTPUT_TOKENS
        )
        input_tokens = int(_prompt_tokens(node) * calls)
        output_tokens = int(per_call_out * calls)
        usd = (
            input_tokens * spec.input_usd_per_mtok + output_tokens * spec.output_usd_per_mtok
        ) / 1_000_000

        rows.append(
            NodeEstimate(
                node_id=node.id,
                name=node.name,
                model=spec.id,
                calls=round(calls, 3),
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                usd=round(usd, 6),
            )
        )

    return GraphEstimate(
        nodes=rows,
        usd=round(sum(r.usd for r in rows), 6),
        input_tokens=sum(r.input_tokens for r in rows),
        output_tokens=sum(r.output_tokens for r in rows),
    )

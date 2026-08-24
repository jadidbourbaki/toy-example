"""The agent graph intermediate representation.

Every other module in the package reads or writes an AgentGraph. The
canvas edits one, the code generator compiles one, the runner executes
one, and the optimizer proposes patches against one. The Pydantic models
here are exported to JSON Schema and generated into TypeScript types, so
the browser and the server never disagree about the shape.
"""

from __future__ import annotations

import re
from string import Template
from typing import Annotated, Literal

import networkx as nx
from pydantic import BaseModel, Field

IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


class Position(BaseModel):
    """Where the node sits on the canvas, in canvas coordinates."""

    x: float = 0.0
    y: float = 0.0


class InputConfig(BaseModel):
    kind: Literal["input"] = "input"
    description: str = "The request the agent receives."


class OutputConfig(BaseModel):
    kind: Literal["output"] = "output"
    description: str = "The answer the agent returns."


class LLMConfig(BaseModel):
    """A single model call. One prompt in, one response out."""

    kind: Literal["llm"] = "llm"
    stage: str = "answer"
    model: str = "haiku"
    instructions: str = "You are a careful assistant."
    prompt: str = "${input}"


class ToolConfig(BaseModel):
    """A deterministic call into the tool catalog. No model involved."""

    kind: Literal["tool"] = "tool"
    tool: str = "echo"
    arguments: dict[str, str] = Field(default_factory=dict)


class ReactConfig(BaseModel):
    """A reason-and-act loop. The model calls tools until it answers or
    the iteration cap stops it."""

    kind: Literal["react"] = "react"
    stage: str = "research"
    model: str = "sonnet"
    instructions: str = "Work step by step. Use the tools before answering."
    prompt: str = "${input}"
    tools: list[str] = Field(default_factory=list)
    max_iterations: int = 6


class Route(BaseModel):
    """One labelled branch out of a router. The label matches the label
    on the outgoing edge that carries it."""

    label: str
    description: str = ""


class RouterConfig(BaseModel):
    """A classifier that picks one outgoing branch. Nodes on the
    branches the router does not pick are skipped for that run."""

    kind: Literal["router"] = "router"
    stage: str = "route"
    model: str = "haiku"
    question: str = "Which branch handles this request best?"
    prompt: str = "${input}"
    routes: list[Route] = Field(default_factory=list)


class SubagentConfig(BaseModel):
    """A call into another graph in the same workspace. Saving a graph
    puts it in the palette of every other graph, which is how a network
    of agents gets assembled out of parts that were each built alone."""

    kind: Literal["subagent"] = "subagent"
    graph_id: str = ""
    prompt: str = "${input}"


NodeConfig = Annotated[
    InputConfig
    | OutputConfig
    | LLMConfig
    | ToolConfig
    | ReactConfig
    | RouterConfig
    | SubagentConfig,
    Field(discriminator="kind"),
]


class Node(BaseModel):
    id: str
    name: str
    position: Position = Field(default_factory=Position)
    notes: str = ""
    config: NodeConfig


class Edge(BaseModel):
    """A data dependency. The target reads the source's output through
    a template reference to the source node's name. label carries the
    route name when the source is a router."""

    id: str
    source: str
    target: str
    label: str = ""


class AgentGraph(BaseModel):
    id: str
    name: str
    description: str = ""
    nodes: list[Node] = Field(default_factory=list)
    edges: list[Edge] = Field(default_factory=list)
    sample: list[str] = Field(
        default_factory=list,
        description="Requests the graph should handle well. Measuring a change runs the graph over the sample, so the sample decides what a measured result means.",
    )

    def node(self, node_id: str) -> Node | None:
        return next((n for n in self.nodes if n.id == node_id), None)

    def incoming(self, node_id: str) -> list[Edge]:
        return [e for e in self.edges if e.target == node_id]

    def outgoing(self, node_id: str) -> list[Edge]:
        return [e for e in self.edges if e.source == node_id]


class Problem(BaseModel):
    """One thing wrong with a graph. node_id is empty when the problem
    belongs to the graph as a whole."""

    severity: Literal["error", "warning"]
    message: str
    node_id: str = ""


def stage_of(node: Node) -> str:
    """The stage tag a node's calls carry, empty for nodes that make no
    model call. A stage names what a call is for, which is the level a
    routing decision wants to be made at."""

    return getattr(node.config, "stage", "")


def model_of(node: Node) -> str:
    return getattr(node.config, "model", "")


def references(text: str) -> set[str]:
    """The ${name} references a template mentions."""

    return set(Template(text).get_identifiers())


def render(text: str, values: dict[str, str]) -> str:
    """Substitute ${name} references, leaving unknown ones in place so a
    prompt that legitimately contains braces survives."""

    return Template(text).safe_substitute(values)


def templates_of(node: Node) -> list[str]:
    """Every template string on a node, so validation can check the
    references in all of them at once."""

    fields = ("prompt", "instructions", "question")
    out = [getattr(node.config, f) for f in fields if hasattr(node.config, f)]
    if isinstance(node.config, ToolConfig):
        out.extend(node.config.arguments.values())
    return out


def to_digraph(graph: AgentGraph) -> nx.DiGraph:
    """The graph as a networkx DiGraph, so ordering, reachability, and
    cycle detection come from a library rather than from us."""

    digraph = nx.DiGraph()
    digraph.add_nodes_from(node.id for node in graph.nodes)
    for edge in graph.edges:
        if digraph.has_node(edge.source) and digraph.has_node(edge.target):
            digraph.add_edge(edge.source, edge.target, label=edge.label)
    return digraph


def topological_order(graph: AgentGraph) -> list[str] | None:
    """Node ids in dependency order, or None when the graph has a cycle.
    The sort is lexicographic among ready nodes, which keeps generated
    code stable across edits that do not change the shape."""

    try:
        return list(nx.lexicographical_topological_sort(to_digraph(graph)))
    except nx.NetworkXUnfeasible:
        return None


def find_cycle(graph: AgentGraph) -> list[str]:
    """The node names on one cycle, empty when the graph is acyclic."""

    try:
        edges = nx.find_cycle(to_digraph(graph))
    except nx.NetworkXNoCycle:
        return []
    names: list[str] = []
    for edge in edges:
        source = str(edge[0])
        node = graph.node(source)
        names.append(node.name if node else source)
    return names


def entry_node(graph: AgentGraph) -> str:
    return next((n.id for n in graph.nodes if n.config.kind == "input"), "")


def branch_exclusive(graph: AgentGraph, router_id: str) -> dict[str, set[str]]:
    """Per route label, the nodes that run only when the router picks
    that label. A node a second branch also reaches, or one the request
    reaches without passing through the router, stays out of every set,
    so a join downstream of a branch still runs."""

    router = graph.node(router_id)
    if router is None or not isinstance(router.config, RouterConfig):
        return {}

    digraph = to_digraph(graph)
    reach: dict[str, set[str]] = {}
    for route in router.config.routes:
        seeds = {e.target for e in graph.outgoing(router_id) if e.label == route.label}
        seeds &= set(digraph.nodes)
        covered: set[str] = set(seeds)
        for seed in seeds:
            covered |= nx.descendants(digraph, seed)
        reach[route.label] = covered

    detoured = digraph.copy()
    detoured.remove_edges_from(list(digraph.out_edges(router_id)))
    entry = entry_node(graph)
    without_router = (
        nx.descendants(detoured, entry) | {entry} if detoured.has_node(entry) else set()
    )

    exclusive: dict[str, set[str]] = {}
    for label, nodes in reach.items():
        others = (
            set().union(*(v for k, v in reach.items() if k != label)) if len(reach) > 1 else set()
        )
        exclusive[label] = nodes - others - without_router
    return exclusive


def validate_graph(graph: AgentGraph, known_graphs: set[str] | None = None) -> list[Problem]:
    """Every problem the graph has. An empty list means the graph
    compiles and runs."""

    problems: list[Problem] = []
    ids = {n.id for n in graph.nodes}
    names: dict[str, str] = {}

    for node in graph.nodes:
        if not IDENTIFIER.match(node.name):
            problems.append(
                Problem(
                    severity="error",
                    node_id=node.id,
                    message=f"{node.name!r} is not a usable name. Use letters, digits, and underscores, starting with a letter.",
                )
            )
        if node.name in names:
            problems.append(
                Problem(
                    severity="error",
                    node_id=node.id,
                    message=f"Two nodes are both named {node.name!r}. A template reference needs one name to mean one node.",
                )
            )
        names[node.name] = node.id

    inputs = [n for n in graph.nodes if n.config.kind == "input"]
    outputs = [n for n in graph.nodes if n.config.kind == "output"]
    if len(inputs) != 1:
        problems.append(
            Problem(
                severity="error",
                message=f"A graph needs exactly one input node. Found {len(inputs)}.",
            )
        )
    if len(outputs) != 1:
        problems.append(
            Problem(
                severity="error",
                message=f"A graph needs exactly one output node. Found {len(outputs)}.",
            )
        )

    for edge in graph.edges:
        if edge.source not in ids or edge.target not in ids:
            problems.append(
                Problem(
                    severity="error",
                    message=f"Edge {edge.id} points at a node that is not on the canvas.",
                )
            )
        elif edge.source == edge.target:
            problems.append(
                Problem(
                    severity="error", node_id=edge.source, message="An edge joins a node to itself."
                )
            )

    cycle = find_cycle(graph)
    if cycle:
        loop = " to ".join(cycle)
        problems.append(
            Problem(
                severity="error",
                message=f"The graph loops through {loop}. Use a ReAct node when a stage needs to repeat, since the canvas runs stages in dependency order.",
            )
        )

    for node in graph.nodes:
        sources = [graph.node(e.source) for e in graph.incoming(node.id)]
        available = {s.name for s in sources if s} | {"input"}
        for template in templates_of(node):
            for ref in references(template):
                if ref in available:
                    continue
                if ref in names:
                    problems.append(
                        Problem(
                            severity="error",
                            node_id=node.id,
                            message=f"{node.name} reads ${{{ref}}} without an edge from {ref}. Draw the arrow.",
                        )
                    )
                else:
                    problems.append(
                        Problem(
                            severity="warning",
                            node_id=node.id,
                            message=f"{node.name} reads ${{{ref}}}, which no node produces.",
                        )
                    )

        if isinstance(node.config, RouterConfig):
            labels = {r.label for r in node.config.routes}
            if len(labels) < 2:
                problems.append(
                    Problem(
                        severity="error",
                        node_id=node.id,
                        message=f"{node.name} routes to fewer than two branches. A router needs a choice to make.",
                    )
                )
            edge_labels = {e.label for e in graph.outgoing(node.id)}
            for missing in sorted(labels - edge_labels):
                problems.append(
                    Problem(
                        severity="warning",
                        node_id=node.id,
                        message=f"Route {missing!r} on {node.name} has no outgoing edge carrying it.",
                    )
                )
            for stray in sorted(edge_labels - labels):
                problems.append(
                    Problem(
                        severity="error",
                        node_id=node.id,
                        message=f"An edge out of {node.name} is labelled {stray!r}, which is not one of its routes.",
                    )
                )

        if isinstance(node.config, SubagentConfig):
            if not node.config.graph_id:
                problems.append(
                    Problem(
                        severity="error",
                        node_id=node.id,
                        message=f"{node.name} names no graph to call.",
                    )
                )
            elif node.config.graph_id == graph.id:
                problems.append(
                    Problem(
                        severity="error",
                        node_id=node.id,
                        message=f"{node.name} calls its own graph, which never terminates.",
                    )
                )
            elif known_graphs is not None and node.config.graph_id not in known_graphs:
                problems.append(
                    Problem(
                        severity="error",
                        node_id=node.id,
                        message=f"{node.name} calls a graph that is not in the workspace.",
                    )
                )

        if node.config.kind != "input" and not graph.incoming(node.id):
            problems.append(
                Problem(
                    severity="warning",
                    node_id=node.id,
                    message=f"Nothing reaches {node.name}. It runs on the request alone.",
                )
            )

    return problems

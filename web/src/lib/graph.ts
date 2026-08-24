import type { AgentGraph, Edge, ModelSpec, Node } from "@/types/wire";
import type { NodeKind } from "./kinds";

const uid = (prefix: string): string => `${prefix}${crypto.randomUUID().slice(0, 8)}`;

/** A name that is unique in the graph and legal as a Python identifier. */
export function uniqueName(graph: AgentGraph, base: string): string {
  const taken = new Set(graph.nodes.map((n) => n.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** The cheapest model in the registry that can do what this kind of stage
 *  needs. A ReAct stage calls tools and a router returns one of a fixed set of
 *  labels, so neither can be served by a model missing those. */
export function defaultModel(kind: NodeKind, models: ModelSpec[]): string {
  const capable = models.filter(
    (m) => (kind !== "react" || m.tools) && (kind !== "router" || m.structured),
  );
  const cheapest = [...capable].sort(
    (a, b) =>
      a.input_usd_per_mtok + a.output_usd_per_mtok - (b.input_usd_per_mtok + b.output_usd_per_mtok),
  );
  return cheapest[0]?.id ?? "";
}

export function defaultConfig(kind: NodeKind, models: ModelSpec[]): Node["config"] {
  const model = defaultModel(kind, models);
  switch (kind) {
    case "input":
      return { kind: "input", description: "The request the agent receives." };
    case "output":
      return { kind: "output", description: "The answer the agent returns." };
    case "tool":
      return { kind: "tool", tool: "search_notes", arguments: { query: "${input}" } };
    case "react":
      return {
        kind: "react",
        stage: "research",
        model,
        instructions: "Work step by step. Use the tools before answering.",
        prompt: "${input}",
        tools: ["search_notes"],
        max_iterations: 6,
      };
    case "router":
      return {
        kind: "router",
        stage: "route",
        model,
        question: "Which branch handles this request best?",
        prompt: "${input}",
        routes: [
          { label: "simple", description: "Answerable directly." },
          { label: "complex", description: "Needs more work." },
        ],
      };
    case "subagent":
      return { kind: "subagent", graph_id: "", prompt: "${input}" };
    default:
      return {
        kind: "llm",
        stage: "answer",
        model,
        instructions: "You are a careful assistant.",
        prompt: "${input}",
      };
  }
}

export function makeNode(
  graph: AgentGraph,
  kind: NodeKind,
  x: number,
  y: number,
  models: ModelSpec[],
): Node {
  return {
    id: uid("n"),
    name: uniqueName(graph, kind === "llm" ? "stage" : kind === "tool" ? "search_notes" : kind),
    position: { x, y },
    notes: "",
    config: defaultConfig(kind, models),
  };
}

export function makeEdge(source: string, target: string, label = ""): Edge {
  return { id: uid("e"), source, target, label };
}

export function blankGraph(id: string, name: string): AgentGraph {
  const input: Node = {
    id: uid("n"),
    name: "input",
    position: { x: 0, y: 180 },
    notes: "",
    config: defaultConfig("input", []),
  };
  const output: Node = {
    id: uid("n"),
    name: "output",
    position: { x: 640, y: 180 },
    notes: "",
    config: defaultConfig("output", []),
  };
  return { id, name, description: "", nodes: [input, output], edges: [], sample: [] };
}

/** The names a node may reference, which is what its upstream stages produce. */
export function upstreamNames(graph: AgentGraph, nodeId: string): string[] {
  const sources = graph.edges.filter((e) => e.target === nodeId).map((e) => e.source);
  return graph.nodes.filter((n) => sources.includes(n.id)).map((n) => n.name);
}

export function slugify(text: string): string {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return /^[a-z]/.test(cleaned) ? cleaned : `graph_${cleaned || "1"}`;
}

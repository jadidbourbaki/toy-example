import type { AgentGraph, Edge, Node } from "@/types/wire";
import type { NodeKind } from "./kinds";

let counter = 0;
const uid = (prefix: string): string =>
  `${prefix}${Date.now().toString(36)}${(counter++).toString(36)}`;

/** A name that is unique in the graph and legal as a Python identifier. */
export function uniqueName(graph: AgentGraph, base: string): string {
  const taken = new Set(graph.nodes.map((n) => n.name));
  if (!taken.has(base)) return base;
  for (let i = 2; ; i += 1) {
    const candidate = `${base}_${i}`;
    if (!taken.has(candidate)) return candidate;
  }
}

export function defaultConfig(kind: NodeKind): Node["config"] {
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
        model: "sonnet",
        instructions: "Work step by step. Use the tools before answering.",
        prompt: "${input}",
        tools: ["search_notes"],
        max_iterations: 6,
      };
    case "router":
      return {
        kind: "router",
        stage: "route",
        model: "haiku",
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
        model: "haiku",
        instructions: "You are a careful assistant.",
        prompt: "${input}",
      };
  }
}

export function makeNode(graph: AgentGraph, kind: NodeKind, x: number, y: number): Node {
  return {
    id: uid("n"),
    name: uniqueName(graph, kind === "llm" ? "stage" : kind),
    position: { x, y },
    notes: "",
    config: defaultConfig(kind),
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
    config: defaultConfig("input"),
  };
  const output: Node = {
    id: uid("n"),
    name: "output",
    position: { x: 640, y: 180 },
    notes: "",
    config: defaultConfig("output"),
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

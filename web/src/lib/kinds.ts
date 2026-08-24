import type { Node } from "@/types/wire";

export type NodeKind = Node["config"]["kind"];

export type KindMeta = {
  kind: NodeKind;
  label: string;
  /** What a stage of this kind does, in the words someone building one would use. */
  blurb: string;
  /** The taxonomy hue. Every appearance of this colour means this kind of work. */
  color: string;
  /** Whether a stage of this kind makes a model call, and so carries a stage tag. */
  billed: boolean;
};

export const KINDS: Record<NodeKind, KindMeta> = {
  input: {
    kind: "input",
    label: "Input",
    blurb: "Where the request enters the graph.",
    color: "var(--color-kind-boundary)",
    billed: false,
  },
  output: {
    kind: "output",
    label: "Output",
    blurb: "What the graph returns.",
    color: "var(--color-kind-boundary)",
    billed: false,
  },
  llm: {
    kind: "llm",
    label: "Model call",
    blurb: "One prompt in, one response out.",
    color: "var(--color-kind-llm)",
    billed: true,
  },
  tool: {
    kind: "tool",
    label: "Tool",
    blurb: "A function call. No model, no cost.",
    color: "var(--color-kind-tool)",
    billed: false,
  },
  react: {
    kind: "react",
    label: "ReAct loop",
    blurb: "Calls tools in a loop until it answers.",
    color: "var(--color-kind-react)",
    billed: true,
  },
  router: {
    kind: "router",
    label: "Router",
    blurb: "Picks one branch and skips the rest.",
    color: "var(--color-kind-router)",
    billed: true,
  },
  subagent: {
    kind: "subagent",
    label: "Subagent",
    blurb: "Runs another graph in this workspace.",
    color: "var(--color-kind-subagent)",
    billed: true,
  },
};

export const PALETTE_KINDS: NodeKind[] = ["llm", "tool", "react", "router", "subagent"];

export function kindOf(node: Node): KindMeta {
  return KINDS[node.config.kind];
}

export function usd(value: number): string {
  if (value === 0) return "$0";
  if (value < 0.001) return `$${value.toFixed(5)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function signedUsd(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${usd(Math.abs(value))}`;
}

export function ms(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${value}ms`;
}

import type { Node } from "@/types/wire";

export type NodeKind = Node["config"]["kind"];

/** What a stage of each kind is called. */
export const KIND_LABELS: Record<NodeKind, string> = {
  input: "Input",
  output: "Output",
  llm: "Model call",
  tool: "Tool",
  react: "ReAct loop",
  router: "Router",
  subagent: "Subagent",
};

/** A low-chroma tint per kind, used on the stage's left edge and on its kind
 *  label. It is the only colour a stage carries, so the hue is the answer to
 *  "what sort of stage is this" and nothing else. */
export const KIND_TINT: Record<NodeKind, string> = {
  input: "#9c988e",
  output: "#9c988e",
  llm: "#4c6ea8",
  tool: "#3f7d20",
  react: "#a06a1f",
  router: "#7a4fa0",
  subagent: "#a35340",
};

export const PALETTE_KINDS: NodeKind[] = ["llm", "tool", "react", "router", "subagent"];

/** Whether a kind makes a model call, and so carries a stage tag and a cost. */
export const BILLED: Record<NodeKind, boolean> = {
  input: false,
  output: false,
  llm: true,
  tool: false,
  react: true,
  router: true,
  subagent: true,
};

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

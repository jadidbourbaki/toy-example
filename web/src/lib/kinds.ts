import type { Node } from "@/types/wire";

export type NodeKind = Node["config"]["kind"];

/** What a stage of each kind is called on screen. The wire keeps its own
 *  names, so these are the words a person building a workflow reads. */
export const KIND_LABELS: Record<NodeKind, string> = {
  input: "Start",
  output: "End",
  llm: "Prompt",
  tool: "Tool",
  react: "Agent",
  router: "Branch",
  subagent: "Workflow",
  judge: "Judge",
  approve: "Approve",
};

/** A low-chroma tint per kind. It is the only colour a stage carries. */
export const KIND_TINT: Record<NodeKind, string> = {
  input: "#9c988e",
  output: "#9c988e",
  llm: "#4c6ea8",
  tool: "#3f7d20",
  react: "#a06a1f",
  router: "#7a4fa0",
  judge: "#2e7d7d",
  approve: "#b0456b",
  subagent: "#a35340",
};

/** One line on what each kind does, for the palette. */
export const KIND_HINTS: Record<NodeKind, string> = {
  input: "Where the request comes in.",
  output: "What goes back.",
  llm: "One question to a model.",
  tool: "An action, like sending an email.",
  react: "A model that uses tools until it is done.",
  router: "Pick one path.",
  subagent: "Run another workflow.",
  judge: "Grade a stage and send it back to try again.",
  approve: "Pause for a person to approve.",
};

export const PALETTE_KINDS: NodeKind[] = [
  "llm",
  "react",
  "tool",
  "router",
  "judge",
  "approve",
  "subagent",
];

/** Whether a kind makes a model call, and so carries a stage tag and a cost. */
export const BILLED: Record<NodeKind, boolean> = {
  input: false,
  output: false,
  llm: true,
  tool: false,
  react: true,
  router: true,
  subagent: true,
  judge: true,
  approve: false,
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

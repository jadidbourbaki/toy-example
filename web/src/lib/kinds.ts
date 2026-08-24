import { Box, GitBranch, LogIn, LogOut, MessageSquare, RefreshCw, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Node } from "@/types/wire";

export type NodeKind = Node["config"]["kind"];

/** What a stage of each kind is called, and the mark that stands for it on the
 *  canvas. An icon says the kind without spending a line of text on it. */
export const KIND_LABELS: Record<NodeKind, string> = {
  input: "Input",
  output: "Output",
  llm: "Model call",
  tool: "Tool",
  react: "ReAct loop",
  router: "Router",
  subagent: "Subagent",
};

export const KIND_ICONS: Record<NodeKind, LucideIcon> = {
  input: LogIn,
  output: LogOut,
  llm: MessageSquare,
  tool: Wrench,
  react: RefreshCw,
  router: GitBranch,
  subagent: Box,
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

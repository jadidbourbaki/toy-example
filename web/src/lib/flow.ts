import type { Edge as FlowEdge, Node as FlowNode } from "@xyflow/react";
import { SketchEdge, type SketchEdgeData } from "@/nodes/SketchEdge";
import { SketchNode, type SketchNodeData } from "@/nodes/SketchNode";
import type { AgentGraph, Node } from "@/types/wire";

export const nodeTypes = { stage: SketchNode };
export const edgeTypes = { sketch: SketchEdge };

export type Decorate = (node: Node) => Omit<SketchNodeData, "node">;

/** A graph's nodes the way React Flow wants them. The decorator supplies what
 *  the canvas knows and a preview does not: estimates, run state, callbacks. */
export function flowNodes(graph: AgentGraph, decorate: Decorate): FlowNode<SketchNodeData>[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: "stage",
    position: node.position ?? { x: 0, y: 0 },
    data: { node, ...decorate(node) },
  }));
}

export function flowEdges(graph: AgentGraph, live: Set<string>): FlowEdge<SketchEdgeData>[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    type: "sketch",
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.label || null,
    label: edge.label || undefined,
    data: { live: live.has(edge.target) },
  }));
}

export const STILL: Omit<SketchNodeData, "node"> = {
  running: false,
  next: false,
  skipped: false,
  invalid: false,
  onRemove: () => undefined,
  onEdit: () => undefined,
};

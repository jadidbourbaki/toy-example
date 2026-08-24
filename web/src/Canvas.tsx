import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeChange,
  type NodeMouseHandler,
  MarkerType,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StageNode, type StageNodeData } from "@/nodes/StageNode";
import { type NodeKind } from "@/lib/kinds";
import { useStore } from "@/store";
import type { RunEvent } from "@/types/wire";

const nodeTypes = { stage: StageNode };

export type CanvasProps = {
  running: Set<string>;
  skipped: Set<string>;
};

export function Canvas({ running, skipped }: CanvasProps) {
  const graph = useStore((s) => s.graph);
  const estimate = useStore((s) => s.estimate);
  const measured = useStore((s) => s.measured);
  const problems = useStore((s) => s.problems);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const moveNodes = useStore((s) => s.moveNodes);
  const connect = useStore((s) => s.connect);
  const disconnect = useStore((s) => s.disconnect);
  const removeNode = useStore((s) => s.removeNode);
  const addNode = useStore((s) => s.addNode);
  const wrapper = useRef<HTMLDivElement>(null);

  const invalid = useMemo(
    () =>
      new Set(problems.filter((p) => p.severity === "error" && p.node_id).map((p) => p.node_id)),
    [problems],
  );

  const built = useMemo<FlowNode<StageNodeData>[]>(() => {
    if (!graph) return [];
    const estimates = new Map((estimate?.nodes ?? []).map((row) => [row.node_id, row]));
    return graph.nodes.map((node) => ({
      id: node.id,
      type: "stage",
      position: node.position ?? { x: 0, y: 0 },
      data: {
        node,
        estimate: estimates.get(node.id),
        measured: measured[node.id] as RunEvent | undefined,
        running: running.has(node.id),
        skipped: skipped.has(node.id),
        invalid: invalid.has(node.id),
        onRemove: removeNode,
      },
    }));
  }, [graph, estimate, measured, running, skipped, invalid, removeNode]);

  // React Flow owns node state while a drag is in flight, so a pointer move
  // touches local state and nothing else. Positions reach the store on drag
  // stop, which is the only moment they matter.
  const [nodes, setNodes] = useState<FlowNode<StageNodeData>[]>(built);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setNodes(built);
  }, [built]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode<StageNodeData>>[]) => {
    if (changes.some((c) => c.type === "position" && c.dragging)) dragging.current = true;
    setNodes((current) => applyNodeChanges(changes, current));
  }, []);

  const onNodeDragStop = useCallback(() => {
    dragging.current = false;
    setNodes((current) => {
      moveNodes(Object.fromEntries(current.map((n) => [n.id, n.position])));
      return current;
    });
  }, [moveNodes]);

  const flowEdges = useMemo<FlowEdge[]>(() => {
    if (!graph) return [];
    return graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.label || null,
      label: edge.label || undefined,
      animated: running.has(edge.target),
      // An arrow is what says which way the data goes, and a graph without
      // them is a picture of boxes.
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: running.has(edge.target) ? "var(--color-accent)" : "var(--color-line-strong)",
      },
      style: {
        stroke: running.has(edge.target) ? "var(--color-accent)" : "var(--color-line-strong)",
        strokeWidth: 1.5,
      },
    }));
  }, [graph, running]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        connect(connection.source, connection.target, connection.sourceHandle ?? "");
      }
    },
    [connect],
  );

  const onNodeClick = useCallback<NodeMouseHandler<FlowNode<StageNodeData>>>(
    (_event, node) => select(node.id),
    [select],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/orla-kind") as NodeKind;
      if (!kind || !wrapper.current) return;
      const bounds = wrapper.current.getBoundingClientRect();
      addNode(kind, event.clientX - bounds.left - 110, event.clientY - bounds.top - 30);
    },
    [addNode],
  );

  if (!graph) {
    return <div className="flex flex-1 items-center justify-center text-mute">No agent open.</div>;
  }

  return (
    <div
      ref={wrapper}
      className="relative flex-1"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedId }))}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={() => select(null)}
        onEdgesDelete={(edges) => edges.forEach((edge) => disconnect(edge.id))}
        onNodesDelete={(deleted) => deleted.forEach((node) => removeNode(node.id))}
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: "bezier" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e2e6" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
    </div>
  );
}

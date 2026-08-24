import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type Connection,
  type Edge as FlowEdge,
  type Node as FlowNode,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import { useCallback, useMemo, useRef } from "react";
import { StageNode, type StageNodeData } from "@/nodes/StageNode";
import { KINDS, type NodeKind } from "@/lib/kinds";
import { useStore } from "@/store";
import type { RunEvent } from "@/types/wire";

const nodeTypes = { stage: StageNode };

export type CanvasProps = {
  /** Node ids currently executing, so the canvas can light them up. */
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
  const updateNode = useStore((s) => s.updateNode);
  const connect = useStore((s) => s.connect);
  const disconnect = useStore((s) => s.disconnect);
  const addNode = useStore((s) => s.addNode);
  const wrapper = useRef<HTMLDivElement>(null);

  const invalid = useMemo(
    () =>
      new Set(problems.filter((p) => p.severity === "error" && p.node_id).map((p) => p.node_id)),
    [problems],
  );

  const flowNodes = useMemo<FlowNode<StageNodeData>[]>(() => {
    if (!graph) return [];
    const estimates = new Map((estimate?.nodes ?? []).map((row) => [row.node_id, row]));
    return graph.nodes.map((node) => ({
      id: node.id,
      type: "stage",
      position: node.position ?? { x: 0, y: 0 },
      selected: node.id === selectedId,
      data: {
        node,
        estimate: estimates.get(node.id),
        measured: measured[node.id] as RunEvent | undefined,
        running: running.has(node.id),
        skipped: skipped.has(node.id),
        invalid: invalid.has(node.id),
      },
    }));
  }, [graph, estimate, measured, running, skipped, invalid, selectedId]);

  const flowEdges = useMemo<FlowEdge[]>(() => {
    if (!graph) return [];
    return graph.edges.map((edge) => {
      const source = graph.nodes.find((n) => n.id === edge.source);
      const colour = source ? KINDS[source.config.kind].color : "var(--color-faint)";
      const live = running.has(edge.target) || Boolean(measured[edge.target]);
      return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.label || null,
        label: edge.label || undefined,
        animated: running.has(edge.target),
        style: {
          stroke: live ? colour : "var(--color-line)",
          strokeWidth: live ? 1.8 : 1.4,
        },
      };
    });
  }, [graph, running, measured]);

  const onNodesChange = useCallback(
    (changes: NodeChange<FlowNode<StageNodeData>>[]) => {
      for (const change of changes) {
        if (change.type === "position" && change.position && !change.dragging) {
          updateNode(change.id, { position: change.position });
        }
      }
    },
    [updateNode],
  );

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
      const kind = event.dataTransfer.getData("application/sketch-kind") as NodeKind;
      if (!kind || !wrapper.current) return;
      const bounds = wrapper.current.getBoundingClientRect();
      addNode(kind, event.clientX - bounds.left - 100, event.clientY - bounds.top - 30);
    },
    [addNode],
  );

  if (!graph) {
    return (
      <div className="flex flex-1 items-center justify-center text-mute">
        No graph open. Make one from the rail on the left.
      </div>
    );
  }

  return (
    <div
      ref={wrapper}
      className="relative flex-1"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={() => select(null)}
        onEdgesDelete={(edges) => edges.forEach((edge) => disconnect(edge.id))}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1.35 }}
        minZoom={0.3}
        maxZoom={1.6}
        defaultEdgeOptions={{ type: "smoothstep" }}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--color-line)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}

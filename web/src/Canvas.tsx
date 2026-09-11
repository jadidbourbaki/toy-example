import {
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useReactFlow,
  type Connection,
  type Node as FlowNode,
  type NodeChange,
  type NodeMouseHandler,
} from "@xyflow/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { edgeTypes, flowEdges, flowNodes, nodeTypes } from "@/lib/flow";
import { type NodeKind } from "@/lib/kinds";
import { STAGE_SIZE, type SketchNodeData } from "@/nodes/SketchNode";
import { ChatToggle } from "@/panels/ChatToggle";
import { Composer } from "@/panels/Composer";
import { StageToolbar } from "@/panels/StageToolbar";
import { useStore } from "@/store";
import type { RunEvent } from "@/types/wire";

export function Canvas() {
  const graph = useStore((s) => s.graph);
  const estimate = useStore((s) => s.estimate);
  const measured = useStore((s) => s.measured);
  const problems = useStore((s) => s.problems);
  const running = useStore((s) => s.running);
  const paused = useStore((s) => s.paused);
  const skipped = useStore((s) => s.skipped);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);
  const setEditing = useStore((s) => s.setEditing);
  const moveNodes = useStore((s) => s.moveNodes);
  const connect = useStore((s) => s.connect);
  const disconnect = useStore((s) => s.disconnect);
  const removeNode = useStore((s) => s.removeNode);
  const addNode = useStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();

  const built = useMemo<FlowNode<SketchNodeData>[]>(() => {
    if (!graph) return [];
    const estimates = new Map((estimate?.nodes ?? []).map((row) => [row.node_id, row]));
    const invalid = new Set(problems.filter((p) => p.severity === "error").map((p) => p.node_id));
    return flowNodes(graph, (node) => ({
      estimate: estimates.get(node.id),
      measured: measured[node.id] as RunEvent | undefined,
      running: running.has(node.id),
      next: paused === node.id,
      skipped: skipped.has(node.id),
      invalid: invalid.has(node.id),
      onRemove: removeNode,
      onEdit: setEditing,
    }));
  }, [graph, estimate, measured, running, paused, skipped, problems, removeNode, setEditing]);

  // React Flow owns node state while a drag is in flight, so a pointer move
  // touches local state and nothing else. Positions reach the store on drag
  // stop, which is the only moment they matter.
  const [nodes, setNodes] = useState<FlowNode<SketchNodeData>[]>(built);
  const dragging = useRef(false);

  useEffect(() => {
    if (!dragging.current) setNodes(built);
  }, [built]);

  const onNodesChange = useCallback((changes: NodeChange<FlowNode<SketchNodeData>>[]) => {
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

  const edges = useMemo(() => (graph ? flowEdges(graph, running) : []), [graph, running]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        connect(connection.source, connection.target, connection.sourceHandle ?? "");
      }
    },
    [connect],
  );

  const onNodeClick = useCallback<NodeMouseHandler<FlowNode<SketchNodeData>>>(
    (_event, node) => select(node.id),
    [select],
  );

  const onNodeDoubleClick = useCallback<NodeMouseHandler<FlowNode<SketchNodeData>>>(
    (_event, node) => setEditing(node.id),
    [setEditing],
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData("application/orla-kind") as NodeKind;
      if (!kind) return;
      const at = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      addNode(kind, at.x - STAGE_SIZE.width / 2, at.y - STAGE_SIZE.height / 2);
    },
    [addNode, screenToFlowPosition],
  );

  if (!graph) return null;

  return (
    <div
      style={{ position: "relative", flex: 1, minHeight: 0 }}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <ReactFlow
        nodes={nodes.map((n) => ({ ...n, selected: n.id === selectedId }))}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={() => select(null)}
        onEdgesDelete={(deleted) => deleted.forEach((edge) => disconnect(edge.id))}
        onNodesDelete={(deleted) => deleted.forEach((node) => removeNode(node.id))}
        deleteKeyCode={["Backspace", "Delete"]}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.6}
      >
        <Background variant={BackgroundVariant.Dots} gap={22} size={1.2} color="var(--gray-6)" />
        <Controls showInteractive={false} position="bottom-left" />
        <StageToolbar />
        <Composer />
        <ChatToggle />
      </ReactFlow>
    </div>
  );
}

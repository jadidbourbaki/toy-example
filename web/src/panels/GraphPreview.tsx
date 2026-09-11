import { ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { useMemo } from "react";
import { STILL, edgeTypes, flowEdges, flowNodes, nodeTypes } from "@/lib/flow";
import type { AgentGraph } from "@/types/wire";

export type GraphPreviewProps = { graph: AgentGraph };

/** The whole workflow at a glance, drawn by the same canvas that edits it,
 *  with every interaction switched off. */
export function GraphPreview({ graph }: GraphPreviewProps) {
  const nodes = useMemo(() => flowNodes(graph, () => STILL), [graph]);
  const edges = useMemo(() => flowEdges(graph, new Set()), [graph]);
  return (
    <div className="workflow-preview">
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.02}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        />
      </ReactFlowProvider>
    </div>
  );
}

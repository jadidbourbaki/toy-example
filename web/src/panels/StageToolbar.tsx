import { Panel, useReactFlow } from "@xyflow/react";
import { useRef } from "react";
import { PALETTE_KINDS, type NodeKind } from "@/lib/kinds";
import { STAGE_SIZE } from "@/nodes/SketchNode";
import { StageChip } from "@/panels/StageChip";
import { useStore } from "@/store";

/** The stages that can be drawn, floating over the top of the canvas. A
 *  clicked stage lands just below the toolbar, where it is in view. */
export function StageToolbar() {
  const addNode = useStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();
  const bar = useRef<HTMLDivElement>(null);

  const add = (kind: NodeKind) => {
    const rect = bar.current?.getBoundingClientRect();
    if (!rect) return;
    const at = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 140 });
    addNode(kind, at.x - STAGE_SIZE.width / 2, at.y - STAGE_SIZE.height / 2);
  };

  return (
    <Panel position="top-center">
      <div ref={bar} className="stage-toolbar">
        {PALETTE_KINDS.map((kind) => (
          <StageChip key={kind} kind={kind} onAdd={add} />
        ))}
      </div>
    </Panel>
  );
}

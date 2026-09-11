import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { memo } from "react";
import { sketchPath } from "@/lib/sketch";

export type SketchEdgeData = { live: boolean };

/** An edge drawn the way the stages are: rough.js roughens the bezier, and
 *  the arrowhead is two short pen strokes rather than a filled triangle. */
function SketchEdgeImpl({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  label,
  data,
  selected,
}: EdgeProps) {
  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const live = (data as SketchEdgeData | undefined)?.live ?? false;
  const stroke = live ? "var(--accent-9)" : selected ? "var(--accent-9)" : "var(--gray-11)";
  const strokes = sketchPath(id, path, stroke);
  const head = sketchPath(
    `${id}-head`,
    `M ${targetX - 12} ${targetY - 7} L ${targetX} ${targetY} L ${targetX - 12} ${targetY + 7}`,
    stroke,
  );

  return (
    <>
      <BaseEdge id={id} path={path} interactionWidth={18} />
      {[...strokes, ...head].map((p, index) => (
        <path
          key={index}
          d={p.d}
          stroke={p.stroke}
          strokeWidth={p.strokeWidth}
          fill="none"
          strokeLinecap="round"
          pointerEvents="none"
        />
      ))}
      {label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              fontFamily: "var(--sketch-font-family)",
              fontSize: 15,
              color: "var(--gray-11)",
              background: "var(--color-background)",
              padding: "0 6px",
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const SketchEdge = memo(SketchEdgeImpl);

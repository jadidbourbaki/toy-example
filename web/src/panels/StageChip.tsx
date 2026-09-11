import { Tooltip } from "@radix-ui/themes";
import { KIND_HINTS, KIND_LABELS, KIND_TINT, type NodeKind } from "@/lib/kinds";
import { sketchEllipse } from "@/lib/sketch";

export type StageChipProps = { kind: NodeKind; onAdd: (kind: NodeKind) => void };

const WIDTH = 116;
const HEIGHT = 46;

/** A stage the way it will look on the canvas, small enough for the toolbar.
 *  Click it to add one, or drag it to where it should go. */
export function StageChip({ kind, onAdd }: StageChipProps) {
  const paths = sketchEllipse(`chip-${kind}`, WIDTH, HEIGHT, KIND_TINT[kind], "transparent");
  return (
    <Tooltip content={KIND_HINTS[kind]} delayDuration={400}>
      <button
        className="stage-chip"
        draggable
        onDragStart={(e) => e.dataTransfer.setData("application/orla-kind", kind)}
        onClick={() => onAdd(kind)}
        style={{ width: WIDTH, height: HEIGHT }}
      >
        <svg width={WIDTH} height={HEIGHT}>
          {paths.map((p, i) => (
            <path key={i} d={p.d} stroke={p.stroke} strokeWidth={p.strokeWidth} fill={p.fill} />
          ))}
        </svg>
        <span className="stage-chip-label" style={{ color: KIND_TINT[kind] }}>
          {KIND_LABELS[kind]}
        </span>
      </button>
    </Tooltip>
  );
}

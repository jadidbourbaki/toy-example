import { IconButton } from "@radix-ui/themes";
import { Handle, Position } from "@xyflow/react";
import { Pencil, X } from "lucide-react";
import { memo } from "react";
import { BILLED, KIND_LABELS, KIND_TINT, usd } from "@/lib/kinds";
import { sketchEllipse } from "@/lib/sketch";
import type { Node, NodeEstimate, RunEvent } from "@/types/wire";

export type SketchNodeData = {
  node: Node;
  estimate?: NodeEstimate;
  measured?: RunEvent;
  running: boolean;
  skipped: boolean;
  invalid: boolean;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
};

type SketchNodeProps = { data: SketchNodeData; selected?: boolean };

export const STAGE_SIZE = { width: 260, height: 168 };
export const BOUNDARY_SIZE = { width: 108, height: 108 };

/** A stage as a hand-drawn ellipse. rough.js draws the outline the way a pen
 *  would, and the same seed keeps a stage's wobble still while it is dragged. */
function SketchNodeImpl({ data, selected }: SketchNodeProps) {
  const { node, estimate, measured, running, skipped, invalid, onRemove, onEdit } = data;
  const config = node.config;
  const kind = config.kind;
  const tint = KIND_TINT[kind];
  const boundary = kind === "input" || kind === "output";
  const size = boundary ? BOUNDARY_SIZE : STAGE_SIZE;

  const stroke = invalid ? "var(--red-9)" : selected ? "var(--accent-9)" : "var(--gray-12)";
  const paths = sketchEllipse(node.id, size.width, size.height, stroke, "var(--color-panel-solid)");

  const routes = kind === "router" ? config.routes : [];
  const detail =
    kind === "tool"
      ? config.tool
      : kind === "subagent"
        ? config.graph_id || "pick a workflow"
        : kind === "approve"
          ? config.question
          : "model" in config
            ? config.model || "pick a model"
            : "";

  return (
    <div
      className={`sketch-node${running ? " stage-running" : ""}`}
      style={{ width: size.width, height: size.height, opacity: skipped ? 0.35 : 1 }}
    >
      <svg width={size.width} height={size.height}>
        {paths.map((p, i) => (
          <path
            key={i}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill={p.fill}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {kind !== "input" && <Handle type="target" position={Position.Left} />}

      <div className="sketch-node-body">
        {boundary ? (
          <span style={{ fontSize: 24, color: "var(--gray-11)" }}>{node.name}</span>
        ) : (
          <>
            <span style={{ fontSize: 17, color: tint, lineHeight: 1 }}>{KIND_LABELS[kind]}</span>
            <span
              style={{
                fontSize: 30,
                lineHeight: 1.15,
                marginTop: 6,
                maxWidth: size.width - 48,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {node.name}
            </span>
            <span
              style={{
                fontSize: 17,
                color: "var(--gray-11)",
                marginTop: 4,
                maxWidth: size.width - 56,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {detail}
            </span>
            {BILLED[kind] && (
              <span
                className="num"
                style={{
                  fontSize: 17,
                  marginTop: 3,
                  color: measured ? "var(--green-11)" : "var(--gray-10)",
                }}
                title={measured ? "Measured on the last run" : "Estimated"}
              >
                {usd(measured ? (measured.usd ?? 0) : (estimate?.usd ?? 0))}
              </span>
            )}
          </>
        )}
      </div>

      {!boundary && (
        <div className="sketch-actions">
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            aria-label="Edit this stage"
            onClick={(event) => {
              event.stopPropagation();
              onEdit(node.id);
            }}
          >
            <Pencil size={14} />
          </IconButton>
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            aria-label="Remove this stage"
            onClick={(event) => {
              event.stopPropagation();
              onRemove(node.id);
            }}
          >
            <X size={14} />
          </IconButton>
        </div>
      )}

      {routes.length > 0
        ? routes.map((route, index) => {
            const top = ((index + 1) / (routes.length + 1)) * 100;
            return (
              <Handle
                key={route.label}
                type="source"
                id={route.label}
                position={Position.Right}
                style={{ top: `${top}%` }}
                title={route.label}
              />
            );
          })
        : kind !== "output" && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

export const SketchNode = memo(SketchNodeImpl);

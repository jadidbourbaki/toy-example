import { Handle, Position } from "@xyflow/react";
import { X } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { BILLED, KIND_LABELS, KIND_TINT, usd } from "@/lib/kinds";
import type { Node, NodeEstimate, RunEvent } from "@/types/wire";

export type StageNodeData = {
  node: Node;
  estimate?: NodeEstimate;
  measured?: RunEvent;
  running: boolean;
  skipped: boolean;
  invalid: boolean;
  onRemove: (id: string) => void;
};

type StageNodeProps = { data: StageNodeData; selected?: boolean };

/** A stage reads top to bottom: what kind of work it is, what it is called,
 *  and what it is configured with. The kind is named and tinted rather than
 *  drawn as an icon, so two stages of the same kind are recognisable from
 *  across the canvas without anything to decode. */
function StageNodeImpl({ data, selected }: StageNodeProps) {
  const { node, estimate, measured, running, skipped, invalid, onRemove } = data;
  const config = node.config;
  const kind = config.kind;
  const tint = KIND_TINT[kind];

  if (kind === "input" || kind === "output") {
    return (
      <div
        className={cn(
          "rounded-full border border-dashed bg-page px-4 py-1.5 text-[13px] text-mute",
          selected ? "border-accent" : "border-line-strong",
          skipped && "opacity-40",
        )}
      >
        {kind === "output" && <Handle type="target" position={Position.Left} />}
        {node.name}
        {kind === "input" && <Handle type="source" position={Position.Right} />}
      </div>
    );
  }

  const routes = kind === "router" ? config.routes : [];
  const settings: string[] = [];
  if ("model" in config) settings.push(config.model || "no model");
  if (kind === "react") settings.push(`${config.max_iterations} turns`);
  if (kind === "tool") settings.push(config.tool);
  if (kind === "subagent") settings.push(config.graph_id || "no agent chosen");

  return (
    <div
      className={cn(
        "group relative w-[264px] overflow-hidden rounded-xl border bg-raised",
        "shadow-[0_1px_2px_rgb(27_26_23/0.05),0_10px_24px_-16px_rgb(27_26_23/0.2)]",
        selected ? "border-accent" : "border-line",
        invalid && "border-bad",
        running && "stage-running",
        skipped && "opacity-40",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: tint }} />
      <Handle type="target" position={Position.Left} />

      <div className="py-3 pr-3 pl-4">
        <div className="flex items-baseline gap-2">
          <span className="text-[12px] font-medium" style={{ color: tint }}>
            {KIND_LABELS[kind]}
          </span>
          <span className="flex-1" />
          {BILLED[kind] && (
            <span
              className={cn("num text-[12px]", measured ? "text-accent" : "text-faint")}
              title={measured ? "Measured on the last run" : "Estimated"}
            >
              {usd(measured ? (measured.usd ?? 0) : (estimate?.usd ?? 0))}
            </span>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRemove(node.id);
            }}
            title="Remove this stage"
            className="-mr-1 shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sunk hover:text-bad"
          >
            <X size={13} />
          </button>
        </div>

        <div className="mt-0.5 truncate text-[15px] font-medium">{node.name}</div>

        <div className="mt-2 flex items-center gap-1.5">
          {settings.map((setting) => (
            <span
              key={setting}
              className="truncate rounded-md bg-sunk px-2 py-0.5 text-[12px] text-mute"
            >
              {setting}
            </span>
          ))}
        </div>
      </div>

      {routes.length > 0 && (
        <div className="border-t border-line">
          {routes.map((route) => (
            <div
              key={route.label}
              className="relative border-b border-line py-1.5 pr-4 text-right text-[13px] text-mute last:border-b-0"
            >
              {route.label}
              <Handle type="source" id={route.label} position={Position.Right} />
            </div>
          ))}
        </div>
      )}
      {routes.length === 0 && <Handle type="source" position={Position.Right} />}
    </div>
  );
}

export const StageNode = memo(StageNodeImpl);

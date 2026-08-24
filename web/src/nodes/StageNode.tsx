import { Handle, Position } from "@xyflow/react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { BILLED, KIND_ICONS, KIND_LABELS, usd } from "@/lib/kinds";
import type { Node, NodeEstimate, RunEvent } from "@/types/wire";

export type StageNodeData = {
  node: Node;
  estimate?: NodeEstimate;
  measured?: RunEvent;
  running: boolean;
  skipped: boolean;
  invalid: boolean;
};

type StageNodeProps = { data: StageNodeData; selected?: boolean };

function StageNodeImpl({ data, selected }: StageNodeProps) {
  const { node, estimate, measured, running, skipped, invalid } = data;
  const config = node.config;
  const kind = config.kind;
  const Icon = KIND_ICONS[kind];

  if (kind === "input" || kind === "output") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-page px-3.5 py-2 text-mute",
          selected ? "border-accent" : "border-line-strong",
          skipped && "opacity-40",
        )}
      >
        {kind === "output" && <Handle type="target" position={Position.Left} />}
        <Icon size={14} className="text-faint" />
        {node.name}
        {kind === "input" && <Handle type="source" position={Position.Right} />}
      </div>
    );
  }

  const routes = kind === "router" ? config.routes : [];
  const subtitle =
    kind === "tool"
      ? config.tool
      : kind === "subagent"
        ? config.graph_id || "Pick a graph"
        : "model" in config
          ? config.model
          : "";

  return (
    <div
      className={cn(
        "w-[212px] rounded-lg border bg-page shadow-[0_1px_3px_rgba(20,20,30,0.06)]",
        selected ? "border-accent" : "border-line-strong",
        invalid && "border-bad",
        running && "stage-running",
        skipped && "opacity-40",
      )}
    >
      <Handle type="target" position={Position.Left} />

      <div className="px-3.5 py-3">
        <div className="flex items-center gap-2">
          <Icon size={14} className="shrink-0 text-faint" aria-label={KIND_LABELS[kind]} />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {BILLED[kind] && (
            <span
              className={cn("num shrink-0 text-[13px]", measured ? "text-good" : "text-faint")}
              title={measured ? "Measured on the last run" : "Estimated"}
            >
              {usd(measured ? (measured.usd ?? 0) : (estimate?.usd ?? 0))}
            </span>
          )}
        </div>
        {subtitle && (
          <div className="mt-1 truncate pl-[22px] text-[13px] text-faint">{subtitle}</div>
        )}
      </div>

      {routes.length > 0 ? (
        <div className="border-t border-line">
          {routes.map((route) => (
            <div
              key={route.label}
              className="relative border-b border-line px-3.5 py-1.5 text-right text-[13px] text-mute last:border-b-0"
            >
              {route.label}
              <Handle type="source" id={route.label} position={Position.Right} />
            </div>
          ))}
        </div>
      ) : (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}

export const StageNode = memo(StageNodeImpl);

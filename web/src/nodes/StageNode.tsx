import { Handle, Position } from "@xyflow/react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { BILLED, KIND_LABELS, usd } from "@/lib/kinds";
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

  if (kind === "input" || kind === "output") {
    return (
      <div
        className={cn(
          "rounded-full border bg-panel px-3 py-1.5 text-[12px] text-mute",
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
  const detail =
    kind === "tool"
      ? config.tool
      : kind === "subagent"
        ? config.graph_id || "no graph chosen"
        : "model" in config
          ? config.model
          : "";
  const cost = measured ? (measured.usd ?? 0) : (estimate?.usd ?? 0);

  return (
    <div
      className={cn(
        "min-w-[200px] rounded border bg-page shadow-[0_1px_2px_rgba(0,0,0,0.04)]",
        selected ? "border-accent" : "border-line-strong",
        invalid && "border-bad",
        running && "stage-running",
        skipped && "opacity-40",
      )}
    >
      <Handle type="target" position={Position.Left} />

      <div className="px-3 py-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate text-[13px] text-ink">{node.name}</span>
          {BILLED[kind] && (
            <span
              className={cn("num shrink-0 text-[11px]", measured ? "text-good" : "text-mute")}
              title={measured ? "Measured on the last run" : "Estimated"}
            >
              {usd(cost)}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] text-mute">
          {KIND_LABELS[kind]}
          {detail ? ` · ${detail}` : ""}
        </div>
      </div>

      {routes.length > 0 ? (
        <div className="border-t border-line">
          {routes.map((route) => (
            <div
              key={route.label}
              className="relative border-b border-line px-3 py-1 text-right text-[11px] text-mute last:border-b-0"
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

import { Handle, Position } from "@xyflow/react";
import { X } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { BILLED, usd } from "@/lib/kinds";
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

/** A stage. Its shape says what kind it is, so nothing here carries an icon:
 *  a router lists its routes, a ReAct loop shows its tool budget, a tool shows
 *  the function it calls. Name, model, and cost are the three things every
 *  stage has, and they always sit in the same three places. */
function StageNodeImpl({ data, selected }: StageNodeProps) {
  const { node, estimate, measured, running, skipped, invalid, onRemove } = data;
  const config = node.config;
  const kind = config.kind;

  if (kind === "input" || kind === "output") {
    return (
      <div
        className={cn(
          "rounded-full border bg-raised px-4 py-2 text-[14px] text-mute",
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

  // Two rows on every stage, so a row of them lines up. The chips carry
  // whatever that kind of stage is configured by.
  const primary = "model" in config ? config.model || "no model" : "";
  const secondary =
    kind === "react"
      ? `${config.max_iterations} turns`
      : kind === "tool"
        ? config.tool
        : kind === "subagent"
          ? config.graph_id || "no agent chosen"
          : "";

  return (
    <div
      className={cn(
        "group w-[268px] rounded-xl border bg-raised",
        "shadow-[0_1px_2px_rgb(27_26_23/0.04),0_8px_20px_-12px_rgb(27_26_23/0.14)]",
        selected ? "border-accent" : "border-line",
        invalid && "border-bad",
        running && "stage-running",
        skipped && "opacity-40",
      )}
    >
      <Handle type="target" position={Position.Left} />

      <div className="px-4 pt-3.5 pb-3">
        <div className="flex items-start gap-2">
          <span className="min-w-0 flex-1 truncate font-medium">{node.name}</span>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRemove(node.id);
            }}
            title="Remove this stage"
            className="-mr-1 -mt-0.5 shrink-0 rounded p-0.5 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sunk hover:text-bad"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {primary && (
              <span className="truncate rounded-md bg-sunk px-2 py-0.5 text-[12px] text-mute">
                {primary}
              </span>
            )}
            {secondary && <span className="shrink-0 text-[12px] text-faint">{secondary}</span>}
          </div>
          {BILLED[kind] && (
            <span
              className={cn("num shrink-0 text-[13px]", measured ? "text-accent" : "text-faint")}
              title={measured ? "Measured on the last run" : "Estimated"}
            >
              {usd(measured ? (measured.usd ?? 0) : (estimate?.usd ?? 0))}
            </span>
          )}
        </div>
      </div>

      {routes.length > 0 ? (
        <div className="border-t border-line px-4 py-2">
          {routes.map((route) => (
            <div key={route.label} className="relative py-1 text-right text-[13px] text-mute">
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

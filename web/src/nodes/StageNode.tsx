import { Handle, Position } from "@xyflow/react";
import { memo } from "react";
import { cn } from "@/lib/cn";
import { KINDS, usd } from "@/lib/kinds";
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

/** The one node component. Kind decides the hue, the ports, and the second
 *  line. Everything else is shared, so two stages of different kinds still
 *  read as the same object at a glance. */
function StageNodeImpl({ data, selected }: StageNodeProps) {
  const { node, estimate, measured, running, skipped, invalid } = data;
  const meta = KINDS[node.config.kind];
  const config = node.config;

  const routes = config.kind === "router" ? config.routes : [];
  const spent = measured?.usd ?? 0;

  const detail =
    config.kind === "tool"
      ? config.tool
      : config.kind === "subagent"
        ? config.graph_id || "no graph chosen"
        : config.kind === "react"
          ? `${config.model} · ${config.max_iterations} turns`
          : "model" in config
            ? config.model
            : "";

  // A boundary is where the request enters and the answer leaves, so it gets a
  // shape of its own. Reading a graph should not require checking a label to
  // tell the edges of the pipeline from the work inside it.
  if (config.kind === "input" || config.kind === "output") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-full border bg-slate px-3 py-1.5",
          selected ? "border-chalk/50" : "border-line",
          skipped && "opacity-35",
        )}
      >
        {config.kind === "output" && (
          <Handle type="target" position={Position.Left} className="!left-[-4px]" />
        )}
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color }} />
        <span className="ident text-[12px] text-mute">{node.name}</span>
        {config.kind === "input" && (
          <Handle type="source" position={Position.Right} className="!right-[-4px]" />
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex min-w-[190px] overflow-hidden rounded-[3px] border bg-slate transition-colors",
        selected ? "border-chalk/50" : "border-line",
        invalid && "border-bad/70",
        skipped && "opacity-35",
      )}
      style={selected ? { boxShadow: `0 0 0 1px ${meta.color}55` } : undefined}
    >
      <Handle type="target" position={Position.Left} className="!left-[-4px]" />

      <div
        className={cn("w-[3px] shrink-0", running && "stage-running")}
        style={{ background: meta.color }}
      />

      <div className="min-w-0 flex-1 px-2.5 py-2">
        <div className="flex items-baseline justify-between gap-3">
          <span className="ident truncate text-[13px] text-chalk">{node.name}</span>
          <span className="eyebrow shrink-0" style={{ color: meta.color }}>
            {meta.label}
          </span>
        </div>

        <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line-soft pt-1.5">
          <span className="ident truncate text-[11px] text-mute">{detail}</span>
          {meta.billed && (
            <span
              className={cn("num shrink-0 text-[11px]", measured ? "text-good" : "text-faint")}
              title={measured ? "Measured on the last run" : "Static estimate"}
            >
              {usd(measured ? spent : (estimate?.usd ?? 0))}
            </span>
          )}
        </div>

        {"stage" in config && config.stage && (
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[9px] uppercase tracking-[0.14em] text-faint">stage</span>
            <span className="ident text-[10px] text-mute">{config.stage}</span>
          </div>
        )}
      </div>

      {/* A router's ports are labelled, because which branch an edge carries is
          the whole content of the decision. */}
      {routes.length > 0 ? (
        <div className="flex w-14 shrink-0 flex-col justify-center gap-1 border-l border-line-soft py-1.5">
          {routes.map((route, index) => (
            <div key={route.label} className="relative pr-2 text-right">
              <span className="ident block truncate text-[9px] text-mute">{route.label}</span>
              <Handle
                type="source"
                id={route.label}
                position={Position.Right}
                style={{ top: "50%", right: -4 }}
                className={cn(index === 0 && "!bg-raise")}
              />
            </div>
          ))}
        </div>
      ) : (
        <Handle type="source" position={Position.Right} className="!right-[-4px]" />
      )}
    </div>
  );
}

export const StageNode = memo(StageNodeImpl);

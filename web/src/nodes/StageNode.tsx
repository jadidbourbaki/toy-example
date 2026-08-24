import { Handle, Position } from "@xyflow/react";
import { Pencil, X } from "lucide-react";
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
  onEdit: (id: string) => void;
};

type StageNodeProps = { data: StageNodeData; selected?: boolean };

/** A stage reads top to bottom: what kind of work it is, what it is called,
 *  and what it is configured with. The kind is named and tinted rather than
 *  drawn as an icon, so two stages of the same kind are recognisable from
 *  across the canvas without anything to decode. */
function StageNodeImpl({ data, selected }: StageNodeProps) {
  const { node, estimate, measured, running, skipped, invalid, onRemove, onEdit } = data;
  const config = node.config;
  const kind = config.kind;
  const tint = KIND_TINT[kind];

  if (kind === "input" || kind === "output") {
    return (
      <div
        className={cn(
          "rounded-full border border-dashed bg-card px-4 py-2 text-muted-foregroundd-foreground",
          selected ? "border-primary" : "border-border",
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
        "group relative w-[264px] overflow-hidden rounded-xl border bg-card",
        "shadow-[0_1px_2px_rgb(20_20_20/0.05),0_10px_24px_-16px_rgb(20_20_20/0.2)]",
        selected ? "border-primary" : "border-border",
        invalid && "border-destructive",
        running && "stage-running",
        skipped && "opacity-40",
      )}
    >
      <span className="absolute inset-y-0 left-0 w-[3px]" style={{ background: tint }} />
      <Handle type="target" position={Position.Left} />

      <div className="py-3 pr-3 pl-4">
        <div className="flex items-baseline gap-2">
          <span className="font-medium" style={{ color: tint }}>
            {KIND_LABELS[kind]}
          </span>
          <span className="flex-1" />
          {BILLED[kind] && (
            <span
              className={cn("num", measured ? "text-primary" : "text-muted-foregroundd-foreground")}
              title={measured ? "Measured on the last run" : "Estimated"}
            >
              {usd(measured ? (measured.usd ?? 0) : (estimate?.usd ?? 0))}
            </span>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onEdit(node.id);
            }}
            title="Edit this stage"
            className="shrink-0 rounded p-1 text-muted-foregroundd-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-foreground"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onRemove(node.id);
            }}
            title="Remove this stage"
            className="-mr-1 shrink-0 rounded p-1 text-muted-foregroundd-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent hover:text-destructive"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-0.5 truncate text-[16px] font-semibold">{node.name}</div>

        <div className="mt-2 flex items-center gap-1.5">
          {settings.map((setting) => (
            <span
              key={setting}
              className="truncate rounded-md bg-muted px-2 py-0.5 text-muted-foregroundd-foreground"
            >
              {setting}
            </span>
          ))}
        </div>
      </div>

      {routes.length > 0 && (
        <div className="border-t">
          {routes.map((route) => (
            <div
              key={route.label}
              className="relative border-b py-2 pr-4 text-right text-muted-foregroundd-foreground last:border-b-0"
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

import { cn } from "@/lib/cn";
import { KINDS, usd } from "@/lib/kinds";
import { useStore } from "@/store";
import type { Node } from "@/types/wire";

/** Every stage's share of one request, drawn to scale. The estimate is the
 *  ghost bar. A run fills the measured cost over it, so the gap between what a
 *  graph was predicted to cost and what it did is a thing you look at rather
 *  than compute. */
export function CostSpine() {
  const graph = useStore((s) => s.graph);
  const estimate = useStore((s) => s.estimate);
  const measured = useStore((s) => s.measured);
  const selectedId = useStore((s) => s.selectedId);
  const select = useStore((s) => s.select);

  if (!graph || !estimate) return null;

  const byId = new Map<string, Node>(graph.nodes.map((n) => [n.id, n]));
  const rows = estimate.nodes.filter((row) => row.usd > 0);
  const total = estimate.usd || 1;
  const spent = Object.values(measured).reduce((sum, event) => sum + (event.usd ?? 0), 0);
  const hasRun = Object.keys(measured).length > 0;

  return (
    <div className="flex h-14 shrink-0 items-center gap-4 border-t border-line bg-slate px-4">
      <div className="shrink-0">
        <div className="eyebrow">Per request</div>
        <div className="num text-[15px] leading-tight text-chalk">{usd(estimate.usd)}</div>
      </div>

      <div className="flex h-8 flex-1 items-stretch gap-px overflow-hidden rounded-[2px]">
        {rows.length === 0 && (
          <div className="flex flex-1 items-center justify-center text-[11px] text-faint">
            No billed stages yet. Add a model call to see what it costs.
          </div>
        )}
        {rows.map((row) => {
          const node = byId.get(row.node_id);
          const meta = node ? KINDS[node.config.kind] : KINDS.llm;
          const share = (row.usd / total) * 100;
          const actual = measured[row.node_id]?.usd ?? 0;
          const fill = row.usd > 0 ? Math.min(100, (actual / row.usd) * 100) : 0;
          return (
            <button
              key={row.node_id}
              onClick={() => select(row.node_id)}
              title={`${row.name}: ${usd(row.usd)} estimated${hasRun ? `, ${usd(actual)} measured` : ""}`}
              className={cn(
                "group relative min-w-[3px] overflow-hidden text-left transition-[width] duration-200",
                selectedId === row.node_id && "ring-1 ring-chalk/60",
              )}
              style={{ width: `${share}%`, background: `${meta.color}2e` }}
            >
              <span
                className="absolute inset-x-0 top-0 h-[2.5px]"
                style={{ background: meta.color }}
              />
              {hasRun && (
                <span
                  className="absolute inset-y-0 left-0 transition-[width] duration-300"
                  style={{ width: `${fill}%`, background: `${meta.color}70` }}
                />
              )}
              {share > 9 && (
                <span className="ident absolute inset-x-0 bottom-1 truncate px-1.5 text-[10px] text-chalk/80">
                  {row.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="shrink-0 text-right">
        <div className="eyebrow">{hasRun ? "Last run" : "Tokens"}</div>
        <div className={cn("num text-[13px] leading-tight", hasRun ? "text-good" : "text-mute")}>
          {hasRun
            ? usd(spent)
            : `${estimate.input_tokens.toLocaleString()} in / ${estimate.output_tokens.toLocaleString()} out`}
        </div>
      </div>
    </div>
  );
}

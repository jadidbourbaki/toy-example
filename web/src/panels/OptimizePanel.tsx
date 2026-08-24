import { Sparkles } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { signedUsd, usd } from "@/lib/kinds";
import { useStore } from "@/store";
import type { OptimizeResult, Patch } from "@/types/wire";

export function OptimizePanel() {
  const graph = useStore((s) => s.graph);
  const setGraph = useStore((s) => s.setGraph);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const review = async () => {
    if (!graph) return;
    setBusy(true);
    setError("");
    setAccepted(new Set());
    try {
      setResult(await api.optimize(graph));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) => {
    const next = new Set(accepted);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAccepted(next);
  };

  const chosen: Patch[] =
    result?.patches.filter((p) => p.patch.id && accepted.has(p.patch.id)).map((p) => p.patch) ?? [];

  const applyChosen = async () => {
    if (!graph || chosen.length === 0) return;
    const response = await api.patch(graph, chosen);
    setGraph(response.graph);
    setResult(null);
    setAccepted(new Set());
    setTab("build");
  };

  const delta = result
    ? result.patches
        .filter((p) => p.patch.id && accepted.has(p.patch.id))
        .reduce((sum, p) => sum + p.usd_delta, 0)
    : 0;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <button className="btn btn-primary" onClick={() => void review()} disabled={busy || !graph}>
          <Sparkles size={12} />
          {busy ? "Reviewing" : "Review the graph"}
        </button>
        <div className="flex-1" />
        {accepted.size > 0 && (
          <>
            <span className="num text-[12px] text-mute">
              {accepted.size} selected, {signedUsd(delta)} per request
            </span>
            <button className="btn btn-primary" onClick={() => void applyChosen()}>
              Apply to the canvas
            </button>
          </>
        )}
      </div>

      {error && (
        <div className="border-b border-line bg-bad/10 px-4 py-2 text-[12px] text-bad">{error}</div>
      )}
      {result && !result.ok && (
        <div className="border-b border-line bg-bad/10 px-4 py-2 text-[12px] text-bad">
          {result.error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {result?.summary && (
          <div className="border-b border-line bg-slate px-4 py-3">
            <div className="eyebrow mb-1.5">What it found</div>
            <p className="max-w-3xl text-[13px] leading-relaxed text-chalk">{result.summary}</p>
            <div className="num mt-2 text-[11px] text-faint">
              Baseline {usd(result.baseline_usd)} per request
            </div>
          </div>
        )}

        {result?.patches.map((priced, index) => {
          const id = priced.patch.id ?? String(index);
          const on = accepted.has(id);
          const cheaper = priced.usd_delta < 0;
          return (
            <button
              key={id}
              disabled={!priced.applies}
              onClick={() => {
                toggle(id);
                if (priced.patch.node_id) select(priced.patch.node_id);
              }}
              className={cn(
                "block w-full border-b border-line px-4 py-3 text-left transition-colors",
                on ? "bg-kind-llm/10" : "hover:bg-slate",
                !priced.applies && "opacity-50",
              )}
            >
              <div className="flex items-baseline gap-3">
                <span
                  className={cn(
                    "mt-0.5 h-3 w-3 shrink-0 rounded-[2px] border",
                    on ? "border-kind-llm bg-kind-llm" : "border-faint",
                  )}
                />
                <span className="flex-1 text-[13px] text-chalk">{priced.patch.title}</span>
                <span
                  className={cn("num shrink-0 text-[12px]", cheaper ? "text-good" : "text-faint")}
                >
                  {signedUsd(priced.usd_delta)}
                </span>
              </div>
              <div className="mt-1.5 pl-6">
                <p className="max-w-2xl text-[12px] leading-relaxed text-mute">
                  {priced.patch.rationale}
                </p>
                <div className="ident mt-1.5 text-[10px] text-faint">
                  {priced.patch.op}
                  {priced.patch.node_id ? ` · ${priced.patch.node_id}` : ""}
                </div>
                {priced.problems.map((problem, i) => (
                  <div key={i} className="mt-1 text-[11px] text-bad">
                    {problem}
                  </div>
                ))}
              </div>
            </button>
          );
        })}

        {!result && !busy && (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div className="max-w-md">
              <div className="mb-2 text-[13px] text-chalk">Ask for changes worth making.</div>
              <div className="text-[12px] leading-relaxed text-mute">
                Each proposal is one operation on one stage, priced by applying it to the graph and
                re-estimating. Accept the ones you want and they land on the canvas.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

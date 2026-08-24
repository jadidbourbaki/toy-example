import { FlaskConical, Sparkles, Square } from "lucide-react";
import { useRef, useState } from "react";
import { api, streamMeasure } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ms, signedUsd, usd } from "@/lib/kinds";
import { SampleEditor } from "@/panels/SampleEditor";
import { useStore } from "@/store";
import type { MeasurePlan, OptimizeResult, Patch, PatchMeasurement } from "@/types/wire";

function Record({ measured }: { measured: PatchMeasurement }) {
  const { wins, losses, ties } = measured;
  const verdict =
    losses > wins ? "worse" : wins > losses ? "better" : ties > 0 ? "no difference" : "unjudged";
  const tone = losses > wins ? "text-bad" : wins > losses ? "text-good" : "text-mute";
  return <span className={cn("num", tone)}>{verdict}</span>;
}

function Measured({ measured }: { measured: PatchMeasurement }) {
  const cheaper = measured.usd_delta < 0;
  return (
    <div
      className={cn(
        "mt-2 rounded-[3px] border px-2.5 py-2",
        measured.losses > measured.wins ? "border-bad/40 bg-bad/5" : "border-line bg-panel",
      )}
    >
      <div className="mb-1.5 flex items-center gap-3">
        <span className="text-[13px] text-faint">Measured</span>
        <span className={cn("num text-[13px]", cheaper ? "text-good" : "text-warn")}>
          {signedUsd(measured.usd_delta)} per request
        </span>
        <span className="num text-[13px] text-mute">
          {measured.ms_delta >= 0 ? "+" : "−"}
          {ms(Math.abs(measured.ms_delta))}
        </span>
        <Record measured={measured} />
        <div className="flex-1" />
        <span
          className="num text-[13px] text-mute"
          title="How many sample requests both versions completed. A small n on a loop is noisy."
        >
          n={measured.paired}
        </span>
      </div>

      {measured.error && <div className="mb-1.5 text-[13px] text-bad">{measured.error}</div>}

      {measured.verdicts.map((verdict, index) => (
        <div key={index} className="mb-1 flex items-start gap-2">
          <span
            className={cn(
              "font-mono mt-px w-16 shrink-0 text-[13px]",
              verdict.winner === "candidate"
                ? "text-good"
                : verdict.winner === "baseline"
                  ? "text-bad"
                  : "text-faint",
            )}
          >
            {verdict.winner === "candidate"
              ? "better"
              : verdict.winner === "baseline"
                ? "worse"
                : "tie"}
          </span>
          <span className="text-[13px] leading-snug text-mute">
            {verdict.reason}
            {!verdict.agreed && (
              <span className="text-faint"> (the two orderings disagreed, so it scores a tie)</span>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

export function OptimizePanel() {
  const graph = useStore((s) => s.graph);
  const setGraph = useStore((s) => s.setGraph);
  const select = useStore((s) => s.select);
  const setTab = useStore((s) => s.setTab);
  const [result, setResult] = useState<OptimizeResult | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [measured, setMeasured] = useState<Record<string, PatchMeasurement>>({});
  const [plan, setPlan] = useState<MeasurePlan | null>(null);
  const [baselineUsd, setBaselineUsd] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const chosen: Patch[] =
    result?.patches.filter((p) => p.patch.id && accepted.has(p.patch.id)).map((p) => p.patch) ?? [];

  const review = async () => {
    if (!graph) return;
    setBusy(true);
    setError("");
    setAccepted(new Set());
    setMeasured({});
    setBaselineUsd(null);
    try {
      setResult(await api.optimize(graph));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string) => {
    const next = new Set(accepted);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAccepted(next);
    if (!graph) return;
    const patches =
      result?.patches.filter((p) => p.patch.id && next.has(p.patch.id)).map((p) => p.patch) ?? [];
    setPlan(patches.length ? await api.measurePlan(graph, patches, graph.sample) : null);
  };

  const measure = async () => {
    if (!graph || chosen.length === 0) return;
    setMeasuring(true);
    setError("");
    abort.current = new AbortController();
    try {
      await streamMeasure(
        graph,
        chosen,
        graph.sample,
        (event) => {
          if (event.type === "plan" && event.plan) setPlan(event.plan);
          if (event.type === "baseline_done" && event.baseline) setBaselineUsd(event.baseline.usd);
          if (event.type === "patch_done" && event.patch) {
            const done = event.patch;
            setMeasured((prior) => ({ ...prior, [done.patch_id]: done }));
          }
          if (event.type === "error") setError(event.text);
        },
        abort.current.signal,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setMeasuring(false);
    }
  };

  const applyChosen = async () => {
    if (!graph || chosen.length === 0) return;
    const response = await api.patch(graph, chosen);
    setGraph(response.graph);
    setResult(null);
    setAccepted(new Set());
    setMeasured({});
    setTab("build");
  };

  const regressions = chosen.filter((p) => {
    const record = p.id ? measured[p.id] : undefined;
    return record && record.losses > record.wins;
  }).length;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <button className="btn btn-primary" onClick={() => void review()} disabled={busy || !graph}>
          <Sparkles size={12} />
          {busy ? "Reviewing" : "Review this agent"}
        </button>

        {accepted.size > 0 && (
          <>
            {measuring ? (
              <button className="btn" onClick={() => abort.current?.abort()}>
                <Square size={11} /> Stop
              </button>
            ) : (
              <button
                className="btn"
                onClick={() => void measure()}
                disabled={!graph?.sample.length}
                title={
                  graph?.sample.length
                    ? "Run the baseline and each candidate over the sample"
                    : "Write a sample first"
                }
              >
                <FlaskConical size={12} /> Measure
                {plan ? ` ${usd(plan.projected_usd)}` : ""}
              </button>
            )}
            <div className="flex-1" />
            {regressions > 0 && (
              <span className="mr-1 text-[13px] text-bad">{regressions} measured worse</span>
            )}
            <span className="num text-[13px] text-mute">{accepted.size} selected</span>
            <button className="btn btn-primary" onClick={() => void applyChosen()}>
              Apply to the canvas
            </button>
          </>
        )}
        {accepted.size === 0 && <div className="flex-1" />}
      </div>

      {error && (
        <div className="border-b border-line bg-bad/10 px-4 py-2 text-[13px] text-bad">{error}</div>
      )}
      {result && !result.ok && (
        <div className="border-b border-line bg-bad/10 px-4 py-2 text-[13px] text-bad">
          {result.error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <SampleEditor />

        {result?.summary && (
          <div className="border-b border-line bg-panel px-4 py-3">
            <div className="mb-1.5 text-[13px] text-faint">What it found</div>
            <p className="max-w-3xl text-[13px] leading-relaxed text-ink">{result.summary}</p>
            <div className="num mt-2 flex gap-4 text-[13px] text-faint">
              <span>estimated {usd(result.baseline_usd)} per request</span>
              {baselineUsd !== null && (
                <span className="text-mute">measured {usd(baselineUsd)} per request</span>
              )}
            </div>
          </div>
        )}

        {result?.patches.map((priced, index) => {
          const id = priced.patch.id ?? String(index);
          const on = accepted.has(id);
          const record = measured[id];
          return (
            <div
              key={id}
              className={cn(
                "border-b border-line px-4 py-3",
                on ? "bg-accent/5" : "",
                !priced.applies && "opacity-50",
              )}
            >
              <button
                disabled={!priced.applies}
                onClick={() => {
                  void toggle(id);
                  if (priced.patch.node_id) select(priced.patch.node_id);
                }}
                className="block w-full text-left"
              >
                <div className="flex items-baseline gap-3">
                  <span
                    className={cn(
                      "mt-0.5 h-3 w-3 shrink-0 rounded-[2px] border",
                      on ? "border-accent bg-accent" : "border-faint",
                    )}
                  />
                  <span className="flex-1 text-[13px] text-ink">{priced.patch.title}</span>
                  <span
                    className={cn(
                      "num shrink-0 text-[13px]",
                      record ? "text-mute" : priced.usd_delta < 0 ? "text-good" : "text-faint",
                    )}
                    title={
                      record
                        ? "What the static estimate predicted, before this was measured"
                        : "Static estimate"
                    }
                  >
                    <span className="text-[13px] text-faint">est </span>
                    {signedUsd(priced.usd_delta)}
                  </span>
                </div>
                <div className="mt-1.5 pl-6">
                  <p className="max-w-2xl text-[13px] leading-relaxed text-mute">
                    {priced.patch.rationale}
                  </p>
                  <div className="font-mono mt-1.5 text-[13px] text-faint">
                    {priced.patch.op.replace(/_/g, " ")}
                  </div>
                  {priced.problems.map((problem, i) => (
                    <div key={i} className="mt-1 text-[13px] text-bad">
                      {problem}
                    </div>
                  ))}
                </div>
              </button>

              {record && (
                <div className="pl-6">
                  <Measured measured={record} />
                </div>
              )}
              {measuring && on && !record && (
                <div className="pl-6 pt-2 text-[13px] text-faint">Running the sample…</div>
              )}
            </div>
          );
        })}

        {!result && !busy && (
          <p className="p-4 text-[13px] text-faint">
            Ask for changes worth making, then measure the ones worth testing.
          </p>
        )}
      </div>
    </div>
  );
}

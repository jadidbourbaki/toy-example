import { Play, Square } from "lucide-react";
import { useRef, useState } from "react";
import { streamRun } from "@/lib/api";
import { cn } from "@/lib/cn";
import { KINDS, ms, usd } from "@/lib/kinds";
import { useStore } from "@/store";
import type { RunEvent } from "@/types/wire";

export type RunPanelProps = {
  onRunning: (ids: Set<string>) => void;
  onSkipped: (ids: Set<string>) => void;
};

export function RunPanel({ onRunning, onSkipped }: RunPanelProps) {
  const graph = useStore((s) => s.graph);
  const recordRun = useStore((s) => s.recordRun);
  const select = useStore((s) => s.select);
  const [prompt, setPrompt] = useState("How should I tune retrieval?");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const start = async () => {
    if (!graph) return;
    setBusy(true);
    setError("");
    setEvents([]);
    onSkipped(new Set());
    const collected: RunEvent[] = [];
    const live = new Set<string>();
    const dead = new Set<string>();
    abort.current = new AbortController();

    try {
      await streamRun(
        graph,
        prompt,
        (event) => {
          collected.push(event);
          setEvents([...collected]);
          if (event.type === "node_start" && event.node_id) live.add(event.node_id);
          if (event.type === "node_done" && event.node_id) live.delete(event.node_id);
          if (event.type === "node_skipped" && event.node_id) dead.add(event.node_id);
          onRunning(new Set(live));
          onSkipped(new Set(dead));
        },
        abort.current.signal,
      );
      recordRun(collected);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      onRunning(new Set());
      setBusy(false);
    }
  };

  const stop = () => abort.current?.abort();

  const answer = events.find((e) => e.type === "run_done" && (e.depth ?? 0) === 0);
  const failure = events.find((e) => e.type === "run_error");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
        <input
          className="field flex-1"
          value={prompt}
          placeholder="What should the agent be asked?"
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void start();
          }}
        />
        {busy ? (
          <button className="btn" onClick={stop}>
            <Square size={11} /> Stop
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => void start()} disabled={!graph}>
            <Play size={11} /> Run
          </button>
        )}
      </div>

      {error && (
        <div className="border-b border-line bg-bad/10 px-4 py-2 text-[12px] text-bad">{error}</div>
      )}

      <div className="flex-1 overflow-y-auto">
        {events
          .filter(
            (e) => e.type === "node_done" || e.type === "node_skipped" || e.type === "run_error",
          )
          .filter((e) => e.kind !== "input")
          .map((event, index) => {
            const meta =
              event.kind && event.kind in KINDS ? KINDS[event.kind as keyof typeof KINDS] : null;
            const failed = event.type === "run_error";
            return (
              <button
                key={index}
                onClick={() => event.node_id && select(event.node_id)}
                className="block w-full border-b border-line-soft px-4 py-2.5 text-left hover:bg-slate"
                style={{ paddingLeft: 16 + (event.depth ?? 0) * 14 }}
              >
                <div className="flex items-baseline gap-2.5">
                  <span
                    className="h-3 w-[3px] shrink-0 rounded-[1px]"
                    style={{
                      background: failed
                        ? "var(--color-bad)"
                        : (meta?.color ?? "var(--color-faint)"),
                    }}
                  />
                  <span className="ident text-[12px] text-chalk">{event.name}</span>
                  {event.route && (
                    <span className="ident rounded-[2px] border border-kind-router/50 px-1 text-[10px] text-kind-router">
                      {event.route}
                    </span>
                  )}
                  {event.type === "node_skipped" && (
                    <span className="text-[11px] text-faint">skipped</span>
                  )}
                  <span className="flex-1" />
                  {event.ms ? (
                    <span className="num text-[11px] text-faint">{ms(event.ms)}</span>
                  ) : null}
                  {event.usd ? (
                    <span className="num text-[11px] text-mute">{usd(event.usd)}</span>
                  ) : null}
                </div>
                {event.text && event.type !== "node_skipped" && (
                  <p
                    className={cn(
                      "mt-1 max-w-3xl pl-[22px] text-[12px] leading-relaxed",
                      failed ? "text-bad" : "text-mute",
                    )}
                  >
                    {event.text.length > 400 ? `${event.text.slice(0, 400)}…` : event.text}
                  </p>
                )}
              </button>
            );
          })}

        {answer && !failure && (
          <div className="border-t-2 border-line bg-slate px-4 py-3">
            <div className="eyebrow mb-1.5">Answer</div>
            <p className="max-w-3xl whitespace-pre-wrap text-[13px] leading-relaxed text-chalk">
              {answer.text}
            </p>
            <div className="num mt-2.5 flex gap-4 text-[11px] text-faint">
              <span>{ms(answer.ms ?? 0)}</span>
              <span>{usd(answer.usd ?? 0)}</span>
              <span>
                {(answer.input_tokens ?? 0).toLocaleString()} in /{" "}
                {(answer.output_tokens ?? 0).toLocaleString()} out
              </span>
            </div>
          </div>
        )}

        {events.length === 0 && !busy && (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div className="max-w-md">
              <div className="mb-2 text-[13px] text-chalk">Run the graph you drew.</div>
              <div className="text-[12px] leading-relaxed text-mute">
                Each stage reports what it produced, how long it took, and what it cost. The canvas
                lights up as the run moves through it, and the cost bar fills with measured spend.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

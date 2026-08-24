import { Square } from "lucide-react";
import { useRef, useState } from "react";
import { streamRun } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ms, usd } from "@/lib/kinds";
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
  const [prompt, setPrompt] = useState("How much chunk overlap should I use?");
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

  const answer = events.find((e) => e.type === "run_done" && (e.depth ?? 0) === 0);
  const failure = events.find((e) => e.type === "run_error");

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <input
          className="field flex-1"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void start();
          }}
        />
        {busy ? (
          <button className="btn" onClick={() => abort.current?.abort()}>
            <Square size={12} /> Stop
          </button>
        ) : (
          <button className="btn btn-primary" onClick={() => void start()} disabled={!graph}>
            Run
          </button>
        )}
      </div>

      {error && <div className="border-b border-line px-4 py-2 text-[12px] text-bad">{error}</div>}

      <div className="flex-1 overflow-y-auto">
        {events
          .filter(
            (e) => e.type === "node_done" || e.type === "node_skipped" || e.type === "run_error",
          )
          .filter((e) => e.kind !== "input")
          .map((event, index) => {
            const failed = event.type === "run_error";
            return (
              <button
                key={index}
                onClick={() => event.node_id && select(event.node_id)}
                className="block w-full border-b border-line px-4 py-2 text-left hover:bg-panel"
                style={{ paddingLeft: 16 + (event.depth ?? 0) * 14 }}
              >
                <div className="flex items-baseline gap-2">
                  <span className={cn("text-[12px]", failed ? "text-bad" : "text-ink")}>
                    {event.name}
                  </span>
                  {event.route && (
                    <span className="rounded border border-line px-1 text-[11px] text-mute">
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
                      "mt-0.5 max-w-3xl text-[12px] leading-relaxed",
                      failed ? "text-bad" : "text-mute",
                    )}
                  >
                    {event.text.length > 300 ? `${event.text.slice(0, 300)}…` : event.text}
                  </p>
                )}
              </button>
            );
          })}

        {answer && !failure && (
          <div className="border-t-2 border-line bg-panel px-4 py-3">
            <div className="mb-1 text-[13px] text-faint">Answer</div>
            <p className="max-w-3xl whitespace-pre-wrap text-[13px] leading-relaxed">
              {answer.text}
            </p>
            <div className="num mt-2 flex gap-4 text-[11px] text-faint">
              <span>{ms(answer.ms ?? 0)}</span>
              <span>{usd(answer.usd ?? 0)}</span>
              <span>
                {(answer.input_tokens ?? 0).toLocaleString()} in ·{" "}
                {(answer.output_tokens ?? 0).toLocaleString()} out
              </span>
            </div>
          </div>
        )}

        {events.length === 0 && !busy && (
          <div className="p-4 text-[12px] text-faint">Run this agent to see each stage.</div>
        )}
      </div>
    </div>
  );
}

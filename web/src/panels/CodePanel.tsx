import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { streamCompile } from "@/lib/api";
import { useStore } from "@/store";

const STEP_TEXT: Record<string, string> = {
  writing: "Writing the module",
  checking: "Checking it",
  rejected: "Fixing what the check found",
};

/** How long the compile has been running. A model takes long enough that a
 *  still screen reads as a hang. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(0, (now - since) / 1000);
  return <span className="num text-[12px] text-faint">{seconds.toFixed(1)}s</span>;
}

export function CodePanel() {
  const graph = useStore((s) => s.graph);
  const compile = useStore((s) => s.compile);
  const setCompile = useStore((s) => s.setCompile);
  const [copied, setCopied] = useState(false);

  const start = async () => {
    if (!graph) return;
    setCompile({
      running: true,
      attempt: 0,
      step: "writing",
      result: null,
      problems: [],
      error: "",
      startedAt: Date.now(),
    });
    try {
      await streamCompile(graph, (event) => {
        if (event.type === "error") setCompile({ error: event.text });
        else if (event.type === "done")
          setCompile({ result: event.result, problems: event.problems });
        else setCompile({ step: event.type, attempt: event.attempt, problems: event.problems });
      });
    } catch (err) {
      setCompile({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setCompile({ running: false, step: "" });
    }
  };

  const copy = async () => {
    if (!compile.result?.source) return;
    await navigator.clipboard.writeText(compile.result.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const { result, running, step, attempt, error } = compile;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2">
        <button
          className="btn btn-primary"
          onClick={() => void start()}
          disabled={running || !graph}
        >
          {running ? "Compiling" : "Compile"}
        </button>

        {running && (
          <>
            <span className="text-[12px] text-mute">
              {STEP_TEXT[step] ?? "Working"}
              {attempt > 1 ? ` · attempt ${attempt}` : ""}
            </span>
            <Elapsed since={compile.startedAt} />
          </>
        )}

        {result?.source && !running && (
          <button className="btn" onClick={() => void copy()}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}

        <div className="flex-1" />

        {result && !running && (
          <span className="num text-[12px] text-faint">
            {result.source.split("\n").length} lines · {result.attempts} attempt
            {result.attempts === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {compile.problems.length > 0 && running && (
        <div className="border-b border-line bg-sunk px-4 py-2">
          {compile.problems.map((problem, index) => (
            <div key={index} className="font-mono text-[11px] text-warn">
              {problem}
            </div>
          ))}
        </div>
      )}

      {(error || (result && !result.ok)) && (
        <div className="border-b border-line px-4 py-2">
          {error && <div className="text-[12px] text-bad">{error}</div>}
          {result?.problems.map((problem, index) => (
            <div key={index} className="font-mono text-[11px] text-bad">
              {problem}
            </div>
          ))}
        </div>
      )}

      {result?.notes && !running && (
        <div className="border-b border-line px-4 py-2 text-[12px] text-mute">{result.notes}</div>
      )}

      <div className="flex-1 overflow-auto">
        {result?.source ? (
          <pre className="p-4 font-mono text-[12px] leading-[1.55] text-ink">{result.source}</pre>
        ) : (
          <div className="p-4 text-[12px] text-faint">
            {running ? "" : "Compile this agent into a runnable module."}
          </div>
        )}
      </div>
    </div>
  );
}

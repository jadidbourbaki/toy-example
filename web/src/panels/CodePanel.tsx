import { Check, Copy, Hammer } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/store";
import type { CompileResult } from "@/types/wire";

export function CodePanel() {
  const graph = useStore((s) => s.graph);
  const [result, setResult] = useState<CompileResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const compile = async () => {
    if (!graph) return;
    setBusy(true);
    setError("");
    try {
      setResult(await api.compile(graph));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!result?.source) return;
    await navigator.clipboard.writeText(result.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <button
          className="btn btn-primary"
          onClick={() => void compile()}
          disabled={busy || !graph}
        >
          <Hammer size={12} />
          {busy ? "Compiling" : "Compile"}
        </button>
        {result?.source && (
          <button className="btn" onClick={() => void copy()}>
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
        <div className="flex-1" />
        {result && (
          <span className="num text-[11px] text-faint">
            {result.attempts} attempt{result.attempts === 1 ? "" : "s"} ·{" "}
            {result.source.split("\n").length} lines
          </span>
        )}
      </div>

      {result?.notes && (
        <div className="border-b border-line bg-slate px-4 py-2 text-[12px] leading-relaxed text-mute">
          {result.notes}
        </div>
      )}

      {(error || (result && !result.ok)) && (
        <div className="border-b border-line bg-bad/10 px-4 py-2">
          {error && <div className="text-[12px] text-bad">{error}</div>}
          {result?.problems.map((problem, index) => (
            <div key={index} className="ident text-[11px] text-bad">
              {problem}
            </div>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {result?.source ? (
          <pre className="ident p-4 text-[12px] leading-[1.55] text-chalk">{result.source}</pre>
        ) : (
          <div className="flex h-full items-center justify-center px-8 text-center">
            <div className="max-w-md">
              <div className="mb-2 text-[13px] text-chalk">
                Compile the graph into a pydantic-deep module.
              </div>
              <div className="text-[12px] leading-relaxed text-mute">
                A model writes the source and the result is checked before you see it: it has to
                parse, pass pyflakes, define the entry function, and route every call through a
                stage table. The file runs on its own.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

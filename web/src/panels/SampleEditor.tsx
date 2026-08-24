import { Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/store";

/** The requests a measurement runs against. The sample decides what a measured
 *  result means, so it is edited in the open rather than hidden in a config. */
export function SampleEditor() {
  const graph = useStore((s) => s.graph);
  const patchGraph = useStore((s) => s.patchGraph);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!graph) return null;

  const set = (sample: string[]) => patchGraph({ sample });

  const write = async () => {
    setBusy(true);
    setError("");
    try {
      set(await api.writeSample(graph, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border-b border-line bg-panel px-4 py-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="label">Sample</span>
        <span className="num text-[10px] text-faint">{graph.sample.length} requests</span>
        <div className="flex-1" />
        <button className="btn py-1 text-[11px]" onClick={() => void write()} disabled={busy}>
          <Sparkles size={11} />
          {busy ? "Writing" : graph.sample.length ? "Rewrite" : "Write a sample"}
        </button>
      </div>

      {error && <div className="mb-2 text-[11px] text-bad">{error}</div>}

      {graph.sample.map((request, index) => (
        <div key={index} className="group mb-1 flex items-start gap-1.5">
          <span className="num mt-1.5 w-4 shrink-0 text-right text-[10px] text-faint">
            {index + 1}
          </span>
          <input
            className="field flex-1 py-1 text-[12px]"
            value={request}
            onChange={(e) => set(graph.sample.map((r, i) => (i === index ? e.target.value : r)))}
          />
          <button
            className="mt-1.5 shrink-0 text-faint opacity-0 group-hover:opacity-100 hover:text-bad"
            onClick={() => set(graph.sample.filter((_, i) => i !== index))}
            title="Remove this request"
          >
            <X size={12} />
          </button>
        </div>
      ))}

      <button
        className="ml-5 flex items-center gap-1 text-[11px] text-faint hover:text-ink"
        onClick={() => set([...graph.sample, ""])}
      >
        <Plus size={11} /> Add a request
      </button>

      {graph.sample.length === 0 && (
        <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-faint">
          Measuring runs the graph over these requests, so they should look like the traffic the
          graph will really see.
        </p>
      )}
    </div>
  );
}

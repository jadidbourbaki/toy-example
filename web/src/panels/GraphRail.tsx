import { Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { KIND_LABELS, PALETTE_KINDS } from "@/lib/kinds";
import { useStore } from "@/store";

export function GraphRail() {
  const graphs = useStore((s) => s.graphs);
  const graph = useStore((s) => s.graph);
  const openGraph = useStore((s) => s.openGraph);
  const createGraph = useStore((s) => s.createGraph);
  const addNode = useStore((s) => s.addNode);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const submit = async () => {
    if (name.trim()) await createGraph(name.trim());
    setName("");
    setNaming(false);
  };

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-6 border-r border-line px-3 py-4">
      <div>
        <div className="mb-1 flex items-center justify-between pr-1">
          <span className="section pb-0">Agents</span>
          <button className="btn-quiet" onClick={() => setNaming(true)} title="New agent">
            <Plus size={15} />
          </button>
        </div>

        {naming && (
          <input
            autoFocus
            className="field mb-1 py-1.5"
            placeholder="Agent name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={submit}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
              if (e.key === "Escape") setNaming(false);
            }}
          />
        )}

        {graphs.map((summary) => (
          <button
            key={summary.id}
            className={cn("row", graph?.id === summary.id && "row-on")}
            onClick={() => void openGraph(summary.id)}
          >
            <span className="truncate">{summary.name}</span>
          </button>
        ))}
      </div>

      <div>
        <div className="section">Add a stage</div>
        {PALETTE_KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => addNode(kind, 260 + Math.random() * 140, 90 + Math.random() * 180)}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("application/orla-kind", kind)}
            className="row cursor-grab active:cursor-grabbing"
          >
            {KIND_LABELS[kind]}
          </button>
        ))}
      </div>
    </aside>
  );
}

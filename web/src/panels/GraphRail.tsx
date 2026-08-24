import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { KIND_LABELS, PALETTE_KINDS } from "@/lib/kinds";
import { useStore } from "@/store";

export function GraphRail() {
  const graphs = useStore((s) => s.graphs);
  const graph = useStore((s) => s.graph);
  const openGraph = useStore((s) => s.openGraph);
  const createGraph = useStore((s) => s.createGraph);
  const removeGraph = useStore((s) => s.removeGraph);
  const addNode = useStore((s) => s.addNode);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const submit = async () => {
    if (name.trim()) await createGraph(name.trim());
    setName("");
    setNaming(false);
  };

  return (
    <aside className="flex w-48 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <span className="text-[13px] text-faint">Agents</span>
        <button
          className="text-faint hover:text-ink"
          onClick={() => setNaming(true)}
          title="New agent"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto px-2 pb-2">
        {naming && (
          <input
            autoFocus
            className="field mb-1 text-[12px]"
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
          <div
            key={summary.id}
            className={cn(
              "group flex items-center rounded px-2 py-1",
              graph?.id === summary.id ? "bg-sunk" : "hover:bg-sunk",
            )}
          >
            <button
              className="min-w-0 flex-1 truncate text-left text-[12px]"
              onClick={() => void openGraph(summary.id)}
            >
              {summary.name}
            </button>
            <button
              className="shrink-0 text-faint opacity-0 group-hover:opacity-100 hover:text-bad"
              onClick={() => void removeGraph(summary.id)}
              title={`Delete ${summary.name}`}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <div className="border-t border-line px-3 pt-3 pb-1">
        <span className="text-[13px] text-faint">Stages</span>
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {PALETTE_KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => addNode(kind, 220 + Math.random() * 160, 80 + Math.random() * 200)}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("application/orla-kind", kind)}
            className="block w-full rounded px-2 py-1 text-left text-[12px] hover:bg-sunk"
          >
            {KIND_LABELS[kind]}
          </button>
        ))}
      </div>
    </aside>
  );
}

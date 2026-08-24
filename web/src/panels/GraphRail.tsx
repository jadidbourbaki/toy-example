import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { KINDS, PALETTE_KINDS } from "@/lib/kinds";
import { useStore } from "@/store";
import type { NodeKind } from "@/lib/kinds";

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
    <aside className="flex w-52 shrink-0 flex-col border-r border-line bg-slate">
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <span className="eyebrow">Graphs</span>
        <button
          className="text-faint hover:text-chalk"
          onClick={() => setNaming(true)}
          title="New graph"
        >
          <Plus size={13} />
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto px-1.5 pb-2">
        {naming && (
          <input
            autoFocus
            className="field mb-1 text-[12px]"
            placeholder="Graph name"
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
              "group flex items-center gap-1 rounded-[3px] px-1.5 py-1",
              graph?.id === summary.id ? "bg-raise" : "hover:bg-raise/60",
            )}
          >
            <button className="min-w-0 flex-1 text-left" onClick={() => void openGraph(summary.id)}>
              <div className="truncate text-[12px] text-chalk">{summary.name}</div>
              <div className="ident truncate text-[10px] text-faint">
                {summary.id} · {summary.nodes} stages
              </div>
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

      <div className="border-t border-line px-3 pt-3 pb-2">
        <span className="eyebrow">Add a stage</span>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-3">
        {PALETTE_KINDS.map((kind: NodeKind) => {
          const meta = KINDS[kind];
          return (
            <button
              key={kind}
              onClick={() => addNode(kind, 220 + Math.random() * 160, 80 + Math.random() * 200)}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/sketch-kind", kind)}
              className="flex w-full items-start gap-2 rounded-[3px] px-1.5 py-1.5 text-left hover:bg-raise"
            >
              <span
                className="mt-[3px] h-2.5 w-[3px] shrink-0 rounded-[1px]"
                style={{ background: meta.color }}
              />
              <span className="min-w-0">
                <span className="block text-[12px] text-chalk">{meta.label}</span>
                <span className="block text-[10px] leading-snug text-faint">{meta.blurb}</span>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

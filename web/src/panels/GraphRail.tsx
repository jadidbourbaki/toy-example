import { Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { KIND_LABELS, KIND_TINT, PALETTE_KINDS } from "@/lib/kinds";
import { AgentModal } from "@/panels/AgentModal";
import { useStore } from "@/store";

export function GraphRail() {
  const graphs = useStore((s) => s.graphs);
  const graph = useStore((s) => s.graph);
  const openGraph = useStore((s) => s.openGraph);
  const createGraph = useStore((s) => s.createGraph);
  const addNode = useStore((s) => s.addNode);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const submit = async () => {
    if (name.trim()) await createGraph(name.trim());
    setName("");
    setNaming(false);
  };

  return (
    <aside className="flex w-64 shrink-0 flex-col gap-7 border-r px-3 py-4">
      <div>
        <div className="mb-1 flex items-center justify-between pl-2.5">
          <span className="text-muted-foreground">Agents</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNaming(true)}
            aria-label="New agent"
          >
            <Plus />
          </Button>
        </div>

        {naming && (
          <Input
            autoFocus
            className="mb-1"
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

        {graphs.map((summary) => {
          const active = graph?.id === summary.id;
          return (
            <div
              key={summary.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg pr-1 pl-2.5 transition-colors",
                active ? "bg-muted font-medium" : "hover:bg-accent",
              )}
            >
              <button
                className="min-w-0 flex-1 truncate py-2 text-left"
                onClick={() => void openGraph(summary.id)}
              >
                {summary.name}
              </button>
              {active && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="opacity-0 group-hover:opacity-100"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Agent settings"
                >
                  <Settings2 />
                </Button>
              )}
            </div>
          );
        })}

        <AgentModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>

      <div>
        <div className="mb-1 pl-2.5 text-muted-foreground">Add a stage</div>
        {PALETTE_KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => addNode(kind, 260 + Math.random() * 140, 90 + Math.random() * 180)}
            draggable
            onDragStart={(e) => e.dataTransfer.setData("application/orla-kind", kind)}
            className="flex w-full cursor-grab items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-accent active:cursor-grabbing"
          >
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: KIND_TINT[kind] }}
            />
            {KIND_LABELS[kind]}
          </button>
        ))}
      </div>
    </aside>
  );
}

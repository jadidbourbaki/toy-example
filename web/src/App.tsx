import * as Tabs from "@radix-ui/react-tabs";
import { AlertTriangle, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { Canvas } from "@/Canvas";
import { cn } from "@/lib/cn";
import { CodePanel } from "@/panels/CodePanel";
import { StatusLine } from "@/panels/StatusLine";
import { GraphRail } from "@/panels/GraphRail";
import { Inspector } from "@/panels/Inspector";
import { ModelPicker } from "@/panels/ModelPicker";
import { OptimizePanel } from "@/panels/OptimizePanel";
import { RunPanel } from "@/panels/RunPanel";
import { useStore, type Tab } from "@/store";

const TABS: { id: Tab; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "code", label: "Code" },
  { id: "optimize", label: "Optimize" },
  { id: "run", label: "Run" },
];

export function App() {
  const boot = useStore((s) => s.boot);
  const graph = useStore((s) => s.graph);
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const dirty = useStore((s) => s.dirty);
  const save = useStore((s) => s.save);
  const problems = useStore((s) => s.problems);
  const error = useStore((s) => s.error);
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  useEffect(() => {
    void boot();
  }, [boot]);

  const errors = problems.filter((p) => p.severity === "error").length;
  const warnings = problems.length - errors;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-12 shrink-0 items-center gap-4 border-b border-line bg-panel px-4">
        <span className="font-mono text-[14px] tracking-tight text-ink">sketch</span>
        {graph && (
          <span className="font-mono text-[12px] text-faint">
            <span className="text-mute">{graph.id}</span>
          </span>
        )}

        <Tabs.Root value={tab} onValueChange={(value) => setTab(value as Tab)} className="ml-2">
          <Tabs.List className="flex gap-px rounded-[3px] border border-line p-px">
            {TABS.map((entry) => (
              <Tabs.Trigger
                key={entry.id}
                value={entry.id}
                className={cn(
                  "rounded-[2px] px-3 py-1 text-[12px] transition-colors",
                  tab === entry.id ? "bg-sunk text-ink" : "text-mute hover:text-ink",
                )}
              >
                {entry.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

        <div className="flex-1" />

        {errors > 0 && (
          <span className="flex items-center gap-1.5 text-[12px] text-bad">
            <AlertTriangle size={12} />
            {errors} error{errors === 1 ? "" : "s"}
          </span>
        )}
        {errors === 0 && warnings > 0 && (
          <span className="text-[12px] text-warn">
            {warnings} warning{warnings === 1 ? "" : "s"}
          </span>
        )}
        {error && <span className="text-[12px] text-bad">{error}</span>}

        <ModelPicker />
        <button className="btn" onClick={() => void save()} disabled={!dirty}>
          <Save size={12} />
          {dirty ? "Save" : "Saved"}
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <GraphRail />

        <main className="flex min-w-0 flex-1 flex-col">
          {tab === "build" && <Canvas running={running} skipped={skipped} />}
          {tab === "code" && <CodePanel />}
          {tab === "optimize" && <OptimizePanel />}
          {tab === "run" && <RunPanel onRunning={setRunning} onSkipped={setSkipped} />}
          <StatusLine />
        </main>

        <Inspector />
      </div>
    </div>
  );
}

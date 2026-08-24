import * as Tabs from "@radix-ui/react-tabs";
import { useEffect, useState } from "react";
import { Canvas } from "@/Canvas";
import { cn } from "@/lib/cn";
import { Assistant } from "@/panels/Assistant";
import { CodePanel } from "@/panels/CodePanel";
import { GraphRail } from "@/panels/GraphRail";
import { Inspector } from "@/panels/Inspector";
import { ModelPicker } from "@/panels/ModelPicker";
import { OptimizePanel } from "@/panels/OptimizePanel";
import { RunPanel } from "@/panels/RunPanel";
import { StatusLine } from "@/panels/StatusLine";
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <header className="flex h-14 shrink-0 items-center gap-5 border-b border-line px-4">
        <span className="text-[17px] font-semibold tracking-[-0.02em]">Orla</span>

        {graph && (
          <span className="max-w-[200px] truncate text-[14px] text-mute">{graph.name}</span>
        )}

        <Tabs.Root value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <Tabs.List className="flex items-center gap-0.5 rounded-lg bg-sunk p-0.5">
            {TABS.map((entry) => (
              <Tabs.Trigger
                key={entry.id}
                value={entry.id}
                className={cn(
                  "rounded-md px-3 py-1 text-[14px] transition-colors",
                  tab === entry.id
                    ? "bg-raised text-ink shadow-[0_1px_2px_rgb(27_26_23/0.08)]"
                    : "text-mute hover:text-ink",
                )}
              >
                {entry.label}
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

        <div className="flex-1" />

        {errors > 0 && (
          <span className="text-[13px] text-bad">
            {errors} {errors === 1 ? "problem" : "problems"}
          </span>
        )}
        {error && <span className="text-[13px] text-bad">{error}</span>}

        <ModelPicker />
        {dirty && (
          <button className="btn" onClick={() => void save()}>
            Save
          </button>
        )}
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

        {tab === "build" && <Inspector />}
      </div>

      {graph && <Assistant />}
    </div>
  );
}

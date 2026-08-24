import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { Canvas } from "@/Canvas";
import { cn } from "@/lib/cn";
import { Assistant } from "@/panels/Assistant";
import { CodePanel } from "@/panels/CodePanel";
import { GraphRail } from "@/panels/GraphRail";
import { ModelPicker } from "@/panels/ModelPicker";
import { OptimizePanel } from "@/panels/OptimizePanel";
import { RunPanel } from "@/panels/RunPanel";
import { StageModal } from "@/panels/StageModal";
import { StatusLine } from "@/panels/StatusLine";
import { useStore, type Tab } from "@/store";

const WORK_TABS: { id: Tab; label: string }[] = [
  { id: "build", label: "Build" },
  { id: "code", label: "Code" },
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
      <header className="flex h-14 shrink-0 items-center gap-5 border-b border-border px-4">
        <span className="text-[17px] font-semibold tracking-[-0.02em]">Orla Dashboard</span>

        <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
          <TabsList>
            {WORK_TABS.map((entry) => (
              <TabsTrigger key={entry.id} value={entry.id}>
                {entry.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Optimizing an agent is the product, so it stands apart from the
            working tabs rather than hiding among them. */}
        <Button
          variant={tab === "optimize" ? "default" : "outline"}
          className={cn(tab !== "optimize" && "border-primary/50 text-primary")}
          onClick={() => setTab("optimize")}
        >
          Optimize
        </Button>

        <div className="flex-1" />

        {errors > 0 && (
          <span className="text-destructive">
            {errors} {errors === 1 ? "problem" : "problems"}
          </span>
        )}
        {error && <span className="text-destructive">{error}</span>}

        <ModelPicker />
        {dirty && <Button onClick={() => void save()}>Save</Button>}
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
      </div>

      <StageModal />
      {graph && <Assistant />}
    </div>
  );
}

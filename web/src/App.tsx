import { Badge, Button, Flex, Heading, SegmentedControl, Text } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { Canvas } from "@/Canvas";
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
    <Flex direction="column" style={{ height: "100vh", overflow: "hidden" }}>
      <Flex
        align="center"
        gap="5"
        px="4"
        style={{ height: 56, flexShrink: 0, borderBottom: "1px solid var(--gray-6)" }}
      >
        <Heading size="4" weight="bold">
          Orla Dashboard
        </Heading>

        <SegmentedControl.Root
          value={tab === "optimize" ? "" : tab}
          onValueChange={(value) => value && setTab(value as Tab)}
          size="2"
        >
          {WORK_TABS.map((entry) => (
            <SegmentedControl.Item key={entry.id} value={entry.id}>
              {entry.label}
            </SegmentedControl.Item>
          ))}
        </SegmentedControl.Root>

        {/* Optimizing an agent is the product, so it stands apart from the
            working tabs rather than hiding among them. */}
        <Button
          size="2"
          variant={tab === "optimize" ? "solid" : "outline"}
          onClick={() => setTab("optimize")}
        >
          Optimize
        </Button>

        <Flex flexGrow="1" />

        {errors > 0 && (
          <Badge color="red" size="2">
            {errors} {errors === 1 ? "problem" : "problems"}
          </Badge>
        )}
        {error && (
          <Text size="2" color="red">
            {error}
          </Text>
        )}

        <ModelPicker />
        {dirty && (
          <Button size="2" onClick={() => void save()}>
            Save
          </Button>
        )}
      </Flex>

      <Flex flexGrow="1" style={{ minHeight: 0 }}>
        <GraphRail />
        <Flex direction="column" flexGrow="1" style={{ minWidth: 0 }}>
          {tab === "build" && <Canvas running={running} skipped={skipped} />}
          {tab === "code" && <CodePanel />}
          {tab === "optimize" && <OptimizePanel />}
          {tab === "run" && <RunPanel onRunning={setRunning} onSkipped={setSkipped} />}
          <StatusLine />
        </Flex>
      </Flex>

      <StageModal />
      {graph && <Assistant />}
    </Flex>
  );
}

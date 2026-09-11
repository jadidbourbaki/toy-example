import { Button, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import { useStore } from "@/store";

/** The workflow's name in the top bar. Click it to type a new one. */
export function WorkflowName() {
  const graph = useStore((s) => s.graph);
  const patchGraph = useStore((s) => s.patchGraph);
  const [draft, setDraft] = useState<string | null>(null);
  if (!graph) return null;

  const commit = () => {
    if (draft !== null && draft.trim() && draft.trim() !== graph.name) {
      patchGraph({ name: draft.trim() });
    }
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <TextField.Root
        autoFocus
        size="3"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
        style={{ width: "24ch" }}
      />
    );
  }

  return (
    <Button size="3" variant="ghost" color="gray" onClick={() => setDraft(graph.name)}>
      <Text size="4" weight="bold" truncate>
        {graph.name}
      </Text>
    </Button>
  );
}

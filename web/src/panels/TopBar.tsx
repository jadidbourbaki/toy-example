import { Badge, IconButton, Popover, TextArea } from "@radix-ui/themes";
import { ArrowLeft, Info } from "lucide-react";
import { InlineText } from "@/panels/InlineText";
import { useStore } from "@/store";

/** The row above the canvas: the way back, the workflow's name, what it is
 *  for behind the info button, and whether the graph has problems. */
export function TopBar() {
  const graph = useStore((s) => s.graph);
  const problems = useStore((s) => s.problems);
  const patchGraph = useStore((s) => s.patchGraph);
  const closeGraph = useStore((s) => s.closeGraph);
  const errors = problems.filter((p) => p.severity === "error").length;
  if (!graph) return null;

  return (
    <div className="pane-header">
      <IconButton size="2" variant="ghost" color="gray" onClick={() => void closeGraph()}>
        <ArrowLeft size={20} />
      </IconButton>
      <InlineText value={graph.name} onCommit={(name) => patchGraph({ name })} />
      <Popover.Root>
        <Popover.Trigger>
          <IconButton size="1" variant="ghost" color="gray">
            <Info size={17} />
          </IconButton>
        </Popover.Trigger>
        <Popover.Content size="2" width="380px">
          <TextArea
            size="2"
            rows={3}
            placeholder="What this workflow does"
            value={graph.description}
            onChange={(e) => patchGraph({ description: e.target.value })}
          />
        </Popover.Content>
      </Popover.Root>
      {errors > 0 && (
        <Badge color="red" size="2">
          {errors} {errors === 1 ? "problem" : "problems"}
        </Badge>
      )}
    </div>
  );
}

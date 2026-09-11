import { Badge, IconButton } from "@radix-ui/themes";
import { ArrowLeft } from "lucide-react";
import { WorkflowName } from "@/panels/WorkflowName";
import { useStore } from "@/store";

/** The row above the canvas: the way back, the workflow's name, and whether
 *  the graph has problems. */
export function TopBar() {
  const problems = useStore((s) => s.problems);
  const closeGraph = useStore((s) => s.closeGraph);
  const errors = problems.filter((p) => p.severity === "error").length;

  return (
    <div className="pane-header">
      <IconButton size="2" variant="ghost" color="gray" onClick={() => void closeGraph()}>
        <ArrowLeft size={20} />
      </IconButton>
      <WorkflowName />
      {errors > 0 && (
        <Badge color="red" size="2">
          {errors} {errors === 1 ? "problem" : "problems"}
        </Badge>
      )}
    </div>
  );
}

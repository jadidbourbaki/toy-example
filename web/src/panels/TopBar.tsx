import { Badge, Button, DropdownMenu, Flex, IconButton } from "@radix-ui/themes";
import { ArrowLeft, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { WorkflowModal } from "@/panels/WorkflowModal";
import { WorkflowName } from "@/panels/WorkflowName";
import { useStore } from "@/store";

/** The row above the canvas: the way back, the workflow's name, and the
 *  things that can be done with it. */
export function TopBar() {
  const graph = useStore((s) => s.graph);
  const problems = useStore((s) => s.problems);
  const compile = useStore((s) => s.compile);
  const optimize = useStore((s) => s.optimize);
  const chatOpen = useStore((s) => s.chatOpen);
  const closeGraph = useStore((s) => s.closeGraph);
  const removeGraph = useStore((s) => s.removeGraph);
  const runCompile = useStore((s) => s.runCompile);
  const findImprovements = useStore((s) => s.findImprovements);
  const toggleChat = useStore((s) => s.toggleChat);
  const [details, setDetails] = useState(false);

  const errors = problems.filter((p) => p.severity === "error").length;
  if (!graph) return null;

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

      <Flex align="center" gap="2" ml="auto">
        <Button
          size="2"
          variant="outline"
          onClick={() => void runCompile()}
          disabled={compile.running}
        >
          {compile.running ? "Compiling" : "Compile"}
        </Button>
        <Button
          size="2"
          variant="outline"
          onClick={() => void findImprovements()}
          disabled={optimize.busy}
        >
          {optimize.busy ? "Looking" : "Improve"}
        </Button>
        <Button size="2" variant={chatOpen ? "soft" : "outline"} onClick={toggleChat}>
          Chat
        </Button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton size="2" variant="ghost" color="gray">
              <MoreHorizontal size={18} />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            <DropdownMenu.Item onSelect={() => setDetails(true)}>Details</DropdownMenu.Item>
            <DropdownMenu.Item color="red" onSelect={() => void removeGraph(graph.id)}>
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>

      <WorkflowModal open={details} onClose={() => setDetails(false)} />
    </div>
  );
}

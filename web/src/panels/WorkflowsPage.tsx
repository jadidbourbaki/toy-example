import { AlertDialog, Button, Flex, Heading } from "@radix-ui/themes";
import { Plus } from "lucide-react";
import { useState } from "react";
import { WorkflowCard } from "@/panels/WorkflowCard";
import { useStore } from "@/store";
import type { AgentGraph } from "@/types/wire";

export function WorkflowsPage() {
  const graphs = useStore((s) => s.graphs);
  const openGraph = useStore((s) => s.openGraph);
  const createGraph = useStore((s) => s.createGraph);
  const duplicateGraph = useStore((s) => s.duplicateGraph);
  const removeGraph = useStore((s) => s.removeGraph);
  const [doomed, setDoomed] = useState<AgentGraph | null>(null);

  return (
    <>
      <Flex align="center" mb="6">
        <Heading size="8" style={{ flex: 1 }}>
          Workflows
        </Heading>
        <Button size="3" onClick={() => void createGraph()}>
          <Plus size={18} />
          New workflow
        </Button>
      </Flex>
      <div className="card-grid">
        {graphs.map((graph) => (
          <WorkflowCard
            key={graph.id}
            graph={graph}
            onOpen={() => void openGraph(graph.id)}
            onDuplicate={() => void duplicateGraph(graph.id)}
            onDelete={() => setDoomed(graph)}
          />
        ))}
      </div>

      <AlertDialog.Root open={doomed !== null} onOpenChange={(open) => !open && setDoomed(null)}>
        <AlertDialog.Content maxWidth="420px">
          <AlertDialog.Title size="5">Delete {doomed?.name}?</AlertDialog.Title>
          <Flex justify="end" gap="3" mt="5">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action>
              <Button
                color="red"
                onClick={() => {
                  if (doomed) void removeGraph(doomed.id);
                }}
              >
                Delete
              </Button>
            </AlertDialog.Action>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}

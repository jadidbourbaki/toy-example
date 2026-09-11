import { Button, Flex, Heading } from "@radix-ui/themes";
import { Plus } from "lucide-react";
import { WorkflowCard } from "@/panels/WorkflowCard";
import { useStore } from "@/store";

export function WorkflowsPage() {
  const graphs = useStore((s) => s.graphs);
  const openGraph = useStore((s) => s.openGraph);
  const createGraph = useStore((s) => s.createGraph);
  const duplicateGraph = useStore((s) => s.duplicateGraph);
  const removeGraph = useStore((s) => s.removeGraph);

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
            onDelete={() => void removeGraph(graph.id)}
          />
        ))}
      </div>
    </>
  );
}

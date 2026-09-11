import { Box, Card, DropdownMenu, Heading, IconButton, Text } from "@radix-ui/themes";
import { MoreHorizontal } from "lucide-react";
import { GraphPreview } from "@/panels/GraphPreview";
import type { AgentGraph } from "@/types/wire";

export type WorkflowCardProps = {
  graph: AgentGraph;
  onOpen: () => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
};

/** One workflow on the home screen, drawn the way the canvas draws it. The
 *  menu sits beside the card rather than inside it, so a button never nests
 *  in a button. */
export function WorkflowCard({ graph, onOpen, onDuplicate, onDelete }: WorkflowCardProps) {
  return (
    <Box position="relative" className="workflow-card-slot">
      <Card asChild size="2">
        <button className="workflow-card" onClick={onOpen}>
          <GraphPreview graph={graph} />
          <Heading size="4" mt="3">
            {graph.name}
          </Heading>
          <Text as="p" size="2" color="gray" mt="1" className="clamp">
            {graph.description}
          </Text>
        </button>
      </Card>
      {onDelete && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger>
            <IconButton size="2" variant="soft" color="gray" className="workflow-card-menu">
              <MoreHorizontal size={16} />
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content align="end">
            {onDuplicate && <DropdownMenu.Item onSelect={onDuplicate}>Duplicate</DropdownMenu.Item>}
            <DropdownMenu.Item color="red" onSelect={onDelete}>
              Delete
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      )}
    </Box>
  );
}

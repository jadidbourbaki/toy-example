import { Button, Dialog, Flex, Text, TextArea, TextField } from "@radix-ui/themes";
import { useStore } from "@/store";

export type AgentModalProps = { open: boolean; onClose: () => void };

export function AgentModal({ open, onClose }: AgentModalProps) {
  const graph = useStore((s) => s.graph);
  const patchGraph = useStore((s) => s.patchGraph);
  const removeGraph = useStore((s) => s.removeGraph);
  if (!graph) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Content maxWidth="440px">
        <Dialog.Title size="4">Agent settings</Dialog.Title>

        <Flex direction="column" gap="4" mt="4">
          <Flex align="center" gap="4">
            <Text size="2" color="gray" style={{ width: 96, flexShrink: 0 }}>
              Name
            </Text>
            <TextField.Root
              style={{ flex: 1 }}
              value={graph.name}
              onChange={(e) => patchGraph({ name: e.target.value })}
            />
          </Flex>

          <Flex direction="column" gap="2">
            <Text size="2" color="gray">
              Description
            </Text>
            <TextArea
              rows={3}
              value={graph.description}
              onChange={(e) => patchGraph({ description: e.target.value })}
            />
          </Flex>
        </Flex>

        <Flex align="center" mt="5">
          <Button
            variant="ghost"
            color="red"
            onClick={() => {
              onClose();
              void removeGraph(graph.id);
            }}
          >
            Delete agent
          </Button>
          <Flex flexGrow="1" />
          <Dialog.Close>
            <Button>Done</Button>
          </Dialog.Close>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

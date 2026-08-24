import { Box, Button, Flex, IconButton, Text, TextField } from "@radix-ui/themes";
import { Plus, Settings2 } from "lucide-react";
import { useState } from "react";
import { KIND_LABELS, KIND_TINT, PALETTE_KINDS } from "@/lib/kinds";
import { AgentModal } from "@/panels/AgentModal";
import { useStore } from "@/store";

export function GraphRail() {
  const graphs = useStore((s) => s.graphs);
  const graph = useStore((s) => s.graph);
  const openGraph = useStore((s) => s.openGraph);
  const createGraph = useStore((s) => s.createGraph);
  const addNode = useStore((s) => s.addNode);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

  const submit = async () => {
    if (name.trim()) await createGraph(name.trim());
    setName("");
    setNaming(false);
  };

  return (
    <Flex
      direction="column"
      gap="5"
      p="3"
      style={{ width: 248, flexShrink: 0, borderRight: "1px solid var(--gray-6)" }}
    >
      <Box>
        <Flex align="center" justify="between" pl="2" mb="1">
          <Text size="2" color="gray">
            Agents
          </Text>
          <IconButton
            size="1"
            variant="ghost"
            onClick={() => setNaming(true)}
            aria-label="New agent"
          >
            <Plus size={16} />
          </IconButton>
        </Flex>

        {naming && (
          <Box mb="1">
            <TextField.Root
              autoFocus
              size="2"
              placeholder="Agent name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submit}
              onKeyDown={(e) => {
                if (e.key === "Enter") void submit();
                if (e.key === "Escape") setNaming(false);
              }}
            />
          </Box>
        )}

        {graphs.map((summary) => {
          const active = graph?.id === summary.id;
          return (
            <Flex
              key={summary.id}
              align="center"
              gap="1"
              pl="2"
              pr="1"
              style={{
                borderRadius: "var(--radius-3)",
                background: active ? "var(--gray-4)" : undefined,
              }}
            >
              <Button
                variant="ghost"
                color="gray"
                onClick={() => void openGraph(summary.id)}
                style={{
                  flex: 1,
                  minWidth: 0,
                  justifyContent: "flex-start",
                  fontWeight: active ? 500 : 400,
                  color: active ? "var(--gray-12)" : undefined,
                }}
              >
                <Text truncate>{summary.name}</Text>
              </Button>
              {active && (
                <IconButton
                  size="1"
                  variant="ghost"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Agent settings"
                >
                  <Settings2 size={16} />
                </IconButton>
              )}
            </Flex>
          );
        })}

        <AgentModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </Box>

      <Box>
        <Text size="2" color="gray" ml="2">
          Add a stage
        </Text>
        <Flex direction="column" mt="1">
          {PALETTE_KINDS.map((kind) => (
            <Button
              key={kind}
              variant="ghost"
              color="gray"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("application/orla-kind", kind)}
              onClick={() => addNode(kind, 260 + Math.random() * 140, 90 + Math.random() * 180)}
              style={{ justifyContent: "flex-start", cursor: "grab" }}
            >
              <Box
                width="8px"
                height="8px"
                style={{ borderRadius: 999, background: KIND_TINT[kind] }}
              />
              {KIND_LABELS[kind]}
            </Button>
          ))}
        </Flex>
      </Box>
    </Flex>
  );
}

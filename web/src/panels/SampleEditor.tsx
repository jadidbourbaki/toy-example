import { Box, Button, Flex, IconButton, Text, TextField } from "@radix-ui/themes";
import { ChevronDown, ChevronRight, Plus, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/store";

/** The requests a measurement runs against. */
export function SampleEditor() {
  const graph = useStore((s) => s.graph);
  const patchGraph = useStore((s) => s.patchGraph);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");

  if (!graph) return null;

  const set = (sample: string[]) => patchGraph({ sample });

  const write = async () => {
    setBusy(true);
    setError("");
    try {
      set(await api.writeSample(graph, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box px="4" py="2" style={{ borderBottom: "1px solid var(--gray-6)" }}>
      <Flex align="center" gap="3">
        <Button size="1" variant="ghost" color="gray" onClick={() => setOpen(!open)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          Test requests ({graph.sample.length})
        </Button>
        <Flex flexGrow="1" />
        {open && (
          <Button size="1" variant="outline" onClick={() => void write()} disabled={busy}>
            <Sparkles size={14} />
            {busy ? "Writing" : "Suggest"}
          </Button>
        )}
      </Flex>

      {open && (
        <Box mt="2">
          {error && (
            <Text size="2" color="red" as="p" mb="2">
              {error}
            </Text>
          )}

          <Flex direction="column" gap="2">
            {graph.sample.map((request, index) => (
              <Flex key={index} align="center" gap="2">
                <TextField.Root
                  size="2"
                  style={{ flex: 1 }}
                  value={request}
                  onChange={(e) =>
                    set(graph.sample.map((r, i) => (i === index ? e.target.value : r)))
                  }
                />
                <IconButton
                  size="1"
                  variant="ghost"
                  color="gray"
                  aria-label="Remove this request"
                  onClick={() => set(graph.sample.filter((_, i) => i !== index))}
                >
                  <X size={15} />
                </IconButton>
              </Flex>
            ))}
          </Flex>

          <Button
            size="1"
            variant="ghost"
            color="gray"
            mt="2"
            onClick={() => set([...graph.sample, ""])}
          >
            <Plus size={14} /> Add
          </Button>
        </Box>
      )}
    </Box>
  );
}

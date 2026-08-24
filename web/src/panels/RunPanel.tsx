import { Badge, Box, Button, Flex, ScrollArea, Text, TextField } from "@radix-ui/themes";
import { Square } from "lucide-react";
import { useRef, useState } from "react";
import { streamRun } from "@/lib/api";
import { ms, usd } from "@/lib/kinds";
import { useStore } from "@/store";
import type { RunEvent } from "@/types/wire";

export type RunPanelProps = {
  onRunning: (ids: Set<string>) => void;
  onSkipped: (ids: Set<string>) => void;
};

export function RunPanel({ onRunning, onSkipped }: RunPanelProps) {
  const graph = useStore((s) => s.graph);
  const recordRun = useStore((s) => s.recordRun);
  const setEditing = useStore((s) => s.setEditing);
  const [prompt, setPrompt] = useState("How much chunk overlap should I use?");
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const start = async () => {
    if (!graph) return;
    setBusy(true);
    setError("");
    setEvents([]);
    onSkipped(new Set());
    const collected: RunEvent[] = [];
    const live = new Set<string>();
    const dead = new Set<string>();
    abort.current = new AbortController();

    try {
      await streamRun(
        graph,
        prompt,
        (event) => {
          collected.push(event);
          setEvents([...collected]);
          if (event.type === "node_start" && event.node_id) live.add(event.node_id);
          if (event.type === "node_done" && event.node_id) live.delete(event.node_id);
          if (event.type === "node_skipped" && event.node_id) dead.add(event.node_id);
          onRunning(new Set(live));
          onSkipped(new Set(dead));
        },
        abort.current.signal,
      );
      recordRun(collected);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      onRunning(new Set());
      setBusy(false);
    }
  };

  const answer = events.find((e) => e.type === "run_done" && (e.depth ?? 0) === 0);
  const failure = events.find((e) => e.type === "run_error");

  return (
    <Flex direction="column" flexGrow="1" style={{ minHeight: 0 }}>
      <Flex
        align="center"
        gap="3"
        px="4"
        py="3"
        style={{ borderBottom: "1px solid var(--gray-6)" }}
      >
        <TextField.Root
          size="2"
          style={{ flex: 1 }}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) void start();
          }}
        />
        {busy ? (
          <Button size="2" variant="outline" onClick={() => abort.current?.abort()}>
            <Square size={14} /> Stop
          </Button>
        ) : (
          <Button size="2" onClick={() => void start()} disabled={!graph}>
            Run
          </Button>
        )}
      </Flex>

      {error && (
        <Box px="4" py="2" style={{ background: "var(--red-2)" }}>
          <Text size="2" color="red">
            {error}
          </Text>
        </Box>
      )}

      <ScrollArea style={{ flex: 1 }}>
        {events
          .filter(
            (e) => e.type === "node_done" || e.type === "node_skipped" || e.type === "run_error",
          )
          .filter((e) => e.kind !== "input")
          .map((event, index) => {
            const failed = event.type === "run_error";
            return (
              <Box
                key={index}
                px="4"
                py="3"
                style={{
                  borderBottom: "1px solid var(--gray-4)",
                  paddingLeft: 16 + (event.depth ?? 0) * 16,
                  cursor: event.node_id ? "pointer" : undefined,
                }}
                onClick={() => event.node_id && setEditing(event.node_id)}
              >
                <Flex align="center" gap="2">
                  <Text size="2" weight="medium" color={failed ? "red" : undefined}>
                    {event.name}
                  </Text>
                  {event.route && (
                    <Badge size="1" color="gray" variant="soft">
                      {event.route}
                    </Badge>
                  )}
                  {event.type === "node_skipped" && (
                    <Text size="2" color="gray">
                      skipped
                    </Text>
                  )}
                  <Flex flexGrow="1" />
                  {event.ms ? (
                    <Text size="2" color="gray" className="num">
                      {ms(event.ms)}
                    </Text>
                  ) : null}
                  {event.usd ? (
                    <Text size="2" color="gray" className="num">
                      {usd(event.usd)}
                    </Text>
                  ) : null}
                </Flex>
                {event.text && event.type !== "node_skipped" && (
                  <Text as="p" size="2" color={failed ? "red" : "gray"} mt="1">
                    {event.text.length > 300 ? `${event.text.slice(0, 300)}…` : event.text}
                  </Text>
                )}
              </Box>
            );
          })}

        {answer && !failure && (
          <Box px="4" py="4" style={{ borderTop: "2px solid var(--gray-6)" }}>
            <Text size="2" color="gray">
              Answer
            </Text>
            <Text as="p" mt="2" style={{ whiteSpace: "pre-wrap", maxWidth: "68ch" }}>
              {answer.text}
            </Text>
            <Flex gap="4" mt="3">
              <Text size="2" color="gray" className="num">
                {ms(answer.ms ?? 0)}
              </Text>
              <Text size="2" color="gray" className="num">
                {usd(answer.usd ?? 0)}
              </Text>
              <Text size="2" color="gray" className="num">
                {(answer.input_tokens ?? 0).toLocaleString()} tokens in,{" "}
                {(answer.output_tokens ?? 0).toLocaleString()} out
              </Text>
            </Flex>
          </Box>
        )}

        {events.length === 0 && !busy && (
          <Box p="4">
            <Text size="2" color="gray">
              Run this agent to see each stage.
            </Text>
          </Box>
        )}
      </ScrollArea>
    </Flex>
  );
}

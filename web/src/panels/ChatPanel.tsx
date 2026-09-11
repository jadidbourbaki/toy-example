import { Box, Flex, Heading, IconButton, ScrollArea, Text, TextField } from "@radix-ui/themes";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { streamAsk } from "@/lib/api";
import { useStore } from "@/store";

type Turn = { role: "user" | "assistant"; text: string };

/** Questions about the open workflow, answered against the graph as it stands. */
export function ChatPanel() {
  const graph = useStore((s) => s.graph);
  const toggleChat = useStore((s) => s.toggleChat);
  const [turns, setTurns] = useState<Turn[]>([]);
  const history = useRef<unknown[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns]);

  const send = async () => {
    const asked = question.trim();
    if (!asked || !graph || busy) return;
    setQuestion("");
    setBusy(true);
    const shown = [...turns, { role: "user" as const, text: asked }];
    setTurns([...shown, { role: "assistant" as const, text: "" }]);

    let answer = "";
    try {
      await streamAsk(
        graph,
        asked,
        history.current,
        (delta) => {
          answer += delta;
          setTurns([...shown, { role: "assistant", text: answer }]);
        },
        (updated) => {
          history.current = updated;
        },
      );
    } catch (err) {
      setTurns([
        ...shown,
        { role: "assistant", text: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Flex direction="column" style={{ flex: 1, minHeight: 0 }}>
      <div className="pane-header">
        <Heading size="5" style={{ flex: 1 }}>
          Chat
        </Heading>
        <IconButton size="2" variant="ghost" color="gray" onClick={toggleChat}>
          <X size={18} />
        </IconButton>
      </div>

      <ScrollArea ref={scroller} style={{ flex: 1 }}>
        <Flex direction="column" gap="4" p="4">
          {turns.map((turn, index) => (
            <Box
              key={index}
              p="3"
              style={{
                borderRadius: "var(--radius-4)",
                background: turn.role === "user" ? "var(--accent-3)" : "var(--gray-3)",
                alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
              }}
            >
              <Text size="3" style={{ whiteSpace: "pre-wrap" }}>
                {turn.text || (busy && index === turns.length - 1 ? "Thinking" : "")}
              </Text>
            </Box>
          ))}
        </Flex>
      </ScrollArea>

      <Box p="3" style={{ borderTop: "1px solid var(--gray-6)" }}>
        <TextField.Root
          size="3"
          placeholder="Ask a question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          disabled={busy || !graph}
        />
      </Box>
    </Flex>
  );
}

import { Box, Flex, Heading, IconButton, ScrollArea, Text, TextArea } from "@radix-ui/themes";
import { ArrowUp, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { streamAsk } from "@/lib/api";
import { ChatEmpty } from "@/panels/ChatEmpty";
import { Markdown } from "@/panels/Markdown";
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

  const send = async (text: string = question) => {
    const asked = text.trim();
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
    <Flex direction="column" className="chat-panel" style={{ flex: 1, minHeight: 0 }}>
      <div className="pane-header">
        <Heading size="5" style={{ flex: 1 }}>
          Chat
        </Heading>
        <IconButton size="2" variant="ghost" color="gray" onClick={toggleChat}>
          <X size={18} />
        </IconButton>
      </div>

      {turns.length === 0 && <ChatEmpty onPick={(starter) => void send(starter)} />}

      <ScrollArea ref={scroller} style={{ flex: turns.length ? 1 : 0 }}>
        <Flex direction="column" gap="4" p="4">
          {turns.map((turn, index) => (
            <Box
              key={index}
              p="3"
              className={turn.role === "user" ? "chat-turn-user" : "chat-turn-assistant"}
              style={{
                borderRadius: "var(--radius-4)",
                alignSelf: turn.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "92%",
              }}
            >
              {turn.role === "assistant" ? (
                <Markdown
                  text={turn.text || (busy && index === turns.length - 1 ? "Thinking" : "")}
                />
              ) : (
                <Text size="3" style={{ whiteSpace: "pre-wrap" }}>
                  {turn.text}
                </Text>
              )}
            </Box>
          ))}
        </Flex>
      </ScrollArea>

      <Box px="4" pb="4" pt="2">
        <div className="composer chat-composer">
          <TextArea
            size="2"
            rows={1}
            placeholder="Ask a question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            disabled={busy || !graph}
          />
          <Flex justify="end">
            <IconButton
              size="1"
              radius="full"
              disabled={busy || !question.trim()}
              onClick={() => void send()}
            >
              <ArrowUp size={14} />
            </IconButton>
          </Flex>
        </div>
      </Box>
    </Flex>
  );
}

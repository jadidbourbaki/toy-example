import { Box, Card, Flex, IconButton, Text, TextField } from "@radix-ui/themes";
import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OrlaCat } from "@/components/OrlaCat";
import { streamAsk } from "@/lib/api";
import { useStore } from "@/store";

type Point = { x: number; y: number };
type Turn = { role: "user" | "assistant"; text: string };

const SPOT_KEY = "orla.assistant.spot";
const BLOCK = 6;
const WIDTH = 16 * BLOCK;
const HEIGHT = 12 * BLOCK;

function readSpot(): Point {
  try {
    const stored = localStorage.getItem(SPOT_KEY);
    if (stored) return JSON.parse(stored) as Point;
  } catch {
    // A private window or blocked storage just means the default corner.
  }
  return { x: window.innerWidth - WIDTH - 28, y: window.innerHeight - HEIGHT - 28 };
}

/** A cat that waits in a corner and answers questions about the open agent.
 *  Drag it anywhere. It reads the agent and never edits it. */
export function Assistant() {
  const graph = useStore((s) => s.graph);
  const [spot, setSpot] = useState<Point>(readSpot);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const history = useRef<unknown[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [turns]);

  const onPointerDown = (event: React.PointerEvent) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { dx: event.clientX - spot.x, dy: event.clientY - spot.y, moved: false };
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current.moved = true;
    setSpot({
      x: Math.min(Math.max(0, event.clientX - drag.current.dx), window.innerWidth - WIDTH),
      y: Math.min(Math.max(0, event.clientY - drag.current.dy), window.innerHeight - HEIGHT),
    });
  };

  const onPointerUp = (event: React.PointerEvent) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    const wasDrag = drag.current?.moved ?? false;
    drag.current = null;
    if (wasDrag) {
      try {
        localStorage.setItem(SPOT_KEY, JSON.stringify(spot));
      } catch {
        // Nothing to do. The cat starts in the corner next time.
      }
    } else {
      setOpen(!open);
    }
  };

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

  const below = spot.y < 320;
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    zIndex: 50,
    width: 380,
    height: 440,
    left: Math.min(spot.x, window.innerWidth - 400),
    ...(below ? { top: spot.y + HEIGHT + 14 } : { bottom: window.innerHeight - spot.y + 14 }),
  };

  return (
    <>
      {open && (
        <Card style={panelStyle}>
          <Flex direction="column" style={{ height: "100%" }}>
            <Flex align="center" gap="2" pb="2" style={{ borderBottom: "1px solid var(--gray-6)" }}>
              <Text size="2" color="gray" style={{ flex: 1 }}>
                Ask about this agent
              </Text>
              <IconButton size="1" variant="ghost" color="gray" onClick={() => setOpen(false)}>
                <X size={16} />
              </IconButton>
            </Flex>

            <Box ref={scroller} py="3" style={{ flex: 1, overflowY: "auto" }}>
              {turns.length === 0 && (
                <Text size="2" color="gray">
                  Which stage costs the most? What does the router do here?
                </Text>
              )}
              {turns.map((turn, index) => (
                <Text
                  key={index}
                  as="p"
                  size="2"
                  mb="3"
                  color={turn.role === "user" ? undefined : "gray"}
                  weight={turn.role === "user" ? "medium" : "regular"}
                >
                  {turn.text || (busy && index === turns.length - 1 ? "Thinking" : "")}
                </Text>
              ))}
            </Box>

            <TextField.Root
              size="2"
              placeholder="Ask a question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              disabled={busy}
            />
          </Flex>
        </Card>
      )}

      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{
          position: "fixed",
          zIndex: 50,
          left: spot.x,
          top: spot.y,
          width: WIDTH,
          height: HEIGHT,
          touchAction: "none",
        }}
        title="Ask about this agent"
        aria-label="Ask about this agent"
        className="orla-cat"
      >
        <OrlaCat className="orla-cat-svg" />
      </button>
    </>
  );
}

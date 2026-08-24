import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OrlaCat } from "@/components/OrlaCat";
import { streamAsk } from "@/lib/api";
import { cn } from "@/lib/cn";
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

/** A cat that waits in a corner and answers questions about the open graph.
 *  Drag it anywhere. It reads the graph and never edits it. */
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

  // The panel opens above the cat when there is room, and below when there is not.
  const below = spot.y < 300;
  const panelStyle = {
    left: Math.min(spot.x, window.innerWidth - 400),
    ...(below ? { top: spot.y + HEIGHT + 14 } : { bottom: window.innerHeight - spot.y + 12 }),
  };

  return (
    <>
      {open && (
        <div
          style={panelStyle}
          className="fixed z-50 flex h-[440px] w-[380px] flex-col rounded-xl border border-border bg-background shadow-xl"
        >
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="flex-1 text-muted-foreground">Ask about this agent</span>
            <button
              className="rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-3">
            {turns.length === 0 && (
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                Which stage costs the most? What does the router do here?
              </p>
            )}
            {turns.map((turn, index) => (
              <div
                key={index}
                className={cn(
                  "mb-4 text-[14px] leading-relaxed",
                  turn.role === "user" ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {turn.text || (busy && index === turns.length - 1 ? "Thinking" : "")}
              </div>
            ))}
          </div>

          <div className="border-t border-border p-3">
            <input
              className="w-full rounded-lg border bg-card px-3 py-2"
              placeholder="Ask a question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              disabled={busy}
            />
          </div>
        </div>
      )}

      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ left: spot.x, top: spot.y, width: WIDTH, height: HEIGHT }}
        title="Ask about this agent"
        aria-label="Ask about this agent"
        className="orla-cat fixed z-50 flex touch-none cursor-grab items-end justify-center bg-transparent active:cursor-grabbing"
      >
        <OrlaCat className="h-full w-full" />
      </button>
    </>
  );
}

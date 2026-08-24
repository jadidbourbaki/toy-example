import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { OrlaCat } from "@/components/OrlaCat";
import { streamAsk } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useStore } from "@/store";
import type { Turn } from "@/types/wire";

/** A corner button that waits. It answers questions about the open graph and
 *  never edits it, so opening it costs nothing and ignoring it costs nothing. */
export function Assistant() {
  const graph = useStore((s) => s.graph);
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
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
    const history = [...turns, { role: "user" as const, text: asked }];
    setTurns([...history, { role: "assistant" as const, text: "" }]);

    let answer = "";
    try {
      await streamAsk(graph, asked, turns, (delta) => {
        answer += delta;
        setTurns([...history, { role: "assistant", text: answer }]);
      });
    } catch (err) {
      setTurns([
        ...history,
        { role: "assistant", text: err instanceof Error ? err.message : String(err) },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {open && (
        <div className="fixed right-4 bottom-20 z-50 flex h-[420px] w-[360px] flex-col rounded-lg border border-line bg-page shadow-lg">
          <div className="flex items-center gap-2 border-b border-line px-3 py-2">
            <OrlaCat className="h-5 w-6" />
            <span className="flex-1 text-[12px] text-mute">Ask about this graph</span>
            <button className="text-faint hover:text-ink" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>

          <div ref={scroller} className="flex-1 overflow-y-auto p-3">
            {turns.length === 0 && (
              <div className="text-[12px] leading-relaxed text-faint">
                Try &ldquo;which stage costs the most?&rdquo; or &ldquo;what does the router do
                here?&rdquo;
              </div>
            )}
            {turns.map((turn, index) => (
              <div
                key={index}
                className={cn(
                  "mb-3 text-[12px] leading-relaxed",
                  turn.role === "user" ? "text-ink" : "text-mute",
                )}
              >
                {turn.role === "user" && <span className="label mr-1">You</span>}
                {turn.text || (busy && index === turns.length - 1 ? "…" : "")}
              </div>
            ))}
          </div>

          <div className="border-t border-line p-2">
            <input
              className="field"
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
        onClick={() => setOpen(!open)}
        title="Ask about this graph"
        className="fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-page shadow-md transition-shadow hover:shadow-lg"
      >
        <OrlaCat className="h-8 w-9" />
      </button>
    </>
  );
}

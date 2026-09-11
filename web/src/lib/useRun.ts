import { useRef, useState } from "react";
import { api, streamRun } from "@/lib/api";
import { useStore } from "@/store";
import type { Decision, RunEvent } from "@/types/wire";

/** An Approve stage waiting on the person at the keyboard. */
export type Approval = { token: string; name: string; question: string; text: string };

/** One run of the open workflow: start it, stop it, answer an Approve stage,
 *  and keep what came back. Stages light up on the canvas through the store. */
export function useRun() {
  const graph = useStore((s) => s.graph);
  const recordRun = useStore((s) => s.recordRun);
  const setRunning = useStore((s) => s.setRunning);
  const setSkipped = useStore((s) => s.setSkipped);
  const [prompt, setPrompt] = useState(graph?.sample[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<RunEvent | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const start = async () => {
    if (!graph) return;
    setBusy(true);
    setError("");
    setAnswer(null);
    setSkipped(new Set());
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
          if (event.type === "node_start") live.add(event.node_id);
          if (event.type === "node_done") live.delete(event.node_id);
          if (event.type === "node_skipped") dead.add(event.node_id);
          if (event.type === "approval") {
            setApproval({
              token: event.token,
              name: event.name,
              question: event.route,
              text: event.text,
            });
          }
          if (event.type === "node_done" && event.kind === "approve") setApproval(null);
          if (event.type === "run_done" && event.depth === 0) setAnswer(event);
          if (event.type === "run_error") setError(event.text);
          setRunning(new Set(live));
          setSkipped(new Set(dead));
        },
        abort.current.signal,
      );
      recordRun(collected);
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunning(new Set());
      setApproval(null);
      setBusy(false);
    }
  };

  const stop = () => abort.current?.abort();

  const decide = async (decision: Decision) => {
    if (!approval) return;
    await api.approve(approval.token, decision);
    setApproval(null);
  };

  return {
    prompt,
    setPrompt,
    busy,
    answer,
    approval,
    error,
    start,
    stop,
    decide,
    dismiss: () => setAnswer(null),
  };
}

import { useRef, useState } from "react";
import { api, streamRun } from "@/lib/api";
import { useStore } from "@/store";
import type { Decision, RunEvent } from "@/types/wire";

/** An Approve stage waiting on the person at the keyboard. */
export type Approval = { token: string; name: string; question: string; text: string };

/** One run of the open workflow: start it all at once or one stage at a
 *  time, stop it, answer an Approve stage, and keep what came back. Stages
 *  light up on the canvas through the store as events arrive. */
export function useRun() {
  const graph = useStore((s) => s.graph);
  const recordRun = useStore((s) => s.recordRun);
  const setRunning = useStore((s) => s.setRunning);
  const setSkipped = useStore((s) => s.setSkipped);
  const setPaused = useStore((s) => s.setPaused);
  const [prompt, setPrompt] = useState(graph?.sample[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [stepping, setStepping] = useState(false);
  const [pause, setPause] = useState<string | null>(null);
  const [answer, setAnswer] = useState<RunEvent | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const start = async (step: boolean) => {
    if (!graph) return;
    setBusy(true);
    setStepping(step);
    setError("");
    setAnswer(null);
    setSkipped(new Set());
    recordRun([]);
    const collected: RunEvent[] = [];
    const live = new Set<string>();
    const dead = new Set<string>();
    abort.current = new AbortController();

    try {
      await streamRun(
        graph,
        prompt,
        step,
        (event) => {
          collected.push(event);
          if (event.type === "paused") {
            setPause(event.token);
            setPaused(event.node_id);
          }
          if (event.type === "node_start") {
            setPaused(null);
            live.add(event.node_id);
          }
          if (event.type === "node_done") live.delete(event.node_id);
          if (event.type === "node_skipped") {
            setPaused(null);
            dead.add(event.node_id);
          }
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
          recordRun(collected);
        },
        abort.current.signal,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setRunning(new Set());
      setPaused(null);
      setPause(null);
      setApproval(null);
      setStepping(false);
      setBusy(false);
    }
  };

  const stop = () => abort.current?.abort();

  const next = async () => {
    if (!pause) return;
    const token = pause;
    setPause(null);
    await api.approve(token, { approved: true, note: "" });
  };

  const decide = async (decision: Decision) => {
    if (!approval) return;
    await api.approve(approval.token, decision);
    setApproval(null);
  };

  return {
    prompt,
    setPrompt,
    busy,
    stepping,
    canStep: pause !== null,
    answer,
    approval,
    error,
    start,
    stop,
    next,
    decide,
    dismiss: () => setAnswer(null),
  };
}

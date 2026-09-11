import { createParser } from "eventsource-parser";
import type {
  AgentGraph,
  CompileEvent,
  Decision,
  Health,
  MeasureEvent,
  MeasurePlan,
  ModelSpec,
  OptimizeResult,
  Patch,
  PatchResponse,
  RunEvent,
  ToolSpec,
  ValidateResponse,
} from "@/types/wire";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

const post = <T>(path: string, body: unknown): Promise<T> =>
  request<T>(path, { method: "POST", body: JSON.stringify(body) });

export const api = {
  health: () => request<Health>("/health"),
  listGraphs: () => request<AgentGraph[]>("/graphs"),
  templates: () => request<AgentGraph[]>("/templates"),
  readGraph: (id: string) => request<AgentGraph>(`/graphs/${id}`),
  saveGraph: (graph: AgentGraph) =>
    request<AgentGraph>(`/graphs/${graph.id}`, { method: "PUT", body: JSON.stringify(graph) }),
  deleteGraph: (id: string) => request<{ deleted: boolean }>(`/graphs/${id}`, { method: "DELETE" }),
  models: () => request<ModelSpec[]>("/models"),
  saveModels: (models: ModelSpec[]) =>
    request<ModelSpec[]>("/models", { method: "PUT", body: JSON.stringify(models) }),
  tools: () => request<ToolSpec[]>("/tools"),
  validate: (graph: AgentGraph) => post<ValidateResponse>("/validate", { graph }),
  optimize: (graph: AgentGraph) => post<OptimizeResult>("/optimize", { graph }),
  patch: (graph: AgentGraph, patches: Patch[]) => post<PatchResponse>("/patch", { graph, patches }),
  writeSample: (graph: AgentGraph, count = 3) => post<string[]>("/sample", { graph, count }),
  measurePlan: (graph: AgentGraph, patches: Patch[], sample: string[]) =>
    post<MeasurePlan>("/measure/plan", { graph, patches, sample }),
  approve: (token: string, decision: Decision) =>
    post<{ answered: boolean }>("/approve", { token, decision }),
};

/** Read a server-sent event stream from a POST. EventSource only ever issues a
 *  GET, and both of these endpoints take a graph in the body. */
async function streamPost<T>(
  path: string,
  body: unknown,
  onEvent: (event: T) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`${path} did not start: ${response.status} ${response.statusText}`);
  }

  const parser = createParser({
    onEvent: (message) => {
      if (message.data) onEvent(JSON.parse(message.data) as T);
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(value);
  }
}

export async function streamAsk(
  graph: AgentGraph,
  question: string,
  history: unknown[],
  onDelta: (text: string) => void,
  onHistory: (history: unknown[]) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ graph, question, history }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`The assistant did not answer: ${response.status} ${response.statusText}`);
  }
  const parser = createParser({
    onEvent: (message) => {
      if (message.event === "delta") onDelta(message.data);
      if (message.event === "history") onHistory(JSON.parse(message.data) as unknown[]);
    },
  });
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(value);
  }
}

export function streamCompile(
  graph: AgentGraph,
  onEvent: (event: CompileEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamPost("/compile", { graph }, onEvent, signal);
}

export function streamMeasure(
  graph: AgentGraph,
  patches: Patch[],
  sample: string[],
  onEvent: (event: MeasureEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamPost("/measure", { graph, patches, sample }, onEvent, signal);
}

/** Stream a run, lighting up the canvas as each stage reports. A stepped run
 *  pauses before every stage until the pause is answered. */
export function streamRun(
  graph: AgentGraph,
  prompt: string,
  step: boolean,
  onEvent: (event: RunEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  return streamPost("/run", { graph, request: prompt, step }, onEvent, signal);
}

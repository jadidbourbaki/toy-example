import { createParser } from "eventsource-parser";
import type {
  AgentGraph,
  CompileResult,
  GraphSummary,
  Health,
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
  listGraphs: () => request<GraphSummary[]>("/graphs"),
  readGraph: (id: string) => request<AgentGraph>(`/graphs/${id}`),
  saveGraph: (graph: AgentGraph) =>
    request<AgentGraph>(`/graphs/${graph.id}`, { method: "PUT", body: JSON.stringify(graph) }),
  deleteGraph: (id: string) => request<{ deleted: boolean }>(`/graphs/${id}`, { method: "DELETE" }),
  models: () => request<ModelSpec[]>("/models"),
  saveModels: (models: ModelSpec[]) =>
    request<ModelSpec[]>("/models", { method: "PUT", body: JSON.stringify(models) }),
  tools: () => request<ToolSpec[]>("/tools"),
  validate: (graph: AgentGraph) => post<ValidateResponse>("/validate", { graph }),
  compile: (graph: AgentGraph) => post<CompileResult>("/compile", { graph }),
  optimize: (graph: AgentGraph) => post<OptimizeResult>("/optimize", { graph }),
  patch: (graph: AgentGraph, patches: Patch[]) => post<PatchResponse>("/patch", { graph, patches }),
};

/**
 * Stream a run. The endpoint is a POST, so this reads the body itself rather
 * than going through EventSource, which only ever issues a GET.
 */
export async function streamRun(
  graph: AgentGraph,
  prompt: string,
  onEvent: (event: RunEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/run", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ graph, request: prompt }),
    signal,
  });
  if (!response.ok || !response.body) {
    throw new Error(`The run could not start: ${response.status} ${response.statusText}`);
  }

  const parser = createParser({
    onEvent: (message) => {
      if (message.data) onEvent(JSON.parse(message.data) as RunEvent);
    },
  });

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parser.feed(value);
  }
}

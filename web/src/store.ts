import { create } from "zustand";
import { api } from "@/lib/api";
import { blankGraph, makeEdge, makeNode, slugify } from "@/lib/graph";
import type { NodeKind } from "@/lib/kinds";
import type {
  AgentGraph,
  GraphEstimate,
  GraphSummary,
  ModelSpec,
  Node,
  Problem,
  RunEvent,
  ToolSpec,
} from "@/types/wire";

export type Tab = "build" | "code" | "optimize" | "run";

type State = {
  graph: AgentGraph | null;
  graphs: GraphSummary[];
  models: ModelSpec[];
  tools: ToolSpec[];
  selectedId: string | null;
  tab: Tab;
  problems: Problem[];
  estimate: GraphEstimate | null;
  /** Per node id, what the last run actually spent. Empty until a run finishes. */
  measured: Record<string, RunEvent>;
  dirty: boolean;
  error: string;
};

type Actions = {
  boot: () => Promise<void>;
  openGraph: (id: string) => Promise<void>;
  createGraph: (name: string) => Promise<void>;
  removeGraph: (id: string) => Promise<void>;
  save: () => Promise<void>;
  setTab: (tab: Tab) => void;
  select: (id: string | null) => void;
  setGraph: (graph: AgentGraph) => void;
  patchGraph: (change: Partial<AgentGraph>) => void;
  updateNode: (id: string, change: Partial<Node>) => void;
  updateConfig: (id: string, change: Record<string, unknown>) => void;
  addNode: (kind: NodeKind, x: number, y: number) => void;
  removeNode: (id: string) => void;
  connect: (source: string, target: string, label?: string) => void;
  disconnect: (edgeId: string) => void;
  setModels: (models: ModelSpec[]) => Promise<void>;
  recordRun: (events: RunEvent[]) => void;
  clearMeasured: () => void;
};

/** Validation and pricing both live on the server, so the canvas asks for them
 *  rather than keeping a second opinion. */
async function refresh(graph: AgentGraph, set: (partial: Partial<State>) => void): Promise<void> {
  try {
    const result = await api.validate(graph);
    set({ problems: result.problems, estimate: result.estimate, error: "" });
  } catch (err) {
    set({ error: err instanceof Error ? err.message : String(err) });
  }
}

export const useStore = create<State & Actions>((set, get) => {
  const mutate = (next: AgentGraph) => {
    set({ graph: next, dirty: true });
    void refresh(next, set);
  };

  return {
    graph: null,
    graphs: [],
    models: [],
    tools: [],
    selectedId: null,
    tab: "build",
    problems: [],
    estimate: null,
    measured: {},
    dirty: false,
    error: "",

    boot: async () => {
      const [graphs, models, tools] = await Promise.all([
        api.listGraphs(),
        api.models(),
        api.tools(),
      ]);
      set({ graphs, models, tools });
      const first = graphs[0];
      if (first) await get().openGraph(first.id);
    },

    openGraph: async (id) => {
      const graph = await api.readGraph(id);
      set({ graph, selectedId: null, dirty: false, measured: {}, error: "" });
      await refresh(graph, set);
    },

    createGraph: async (name) => {
      const graph = blankGraph(slugify(name), name);
      await api.saveGraph(graph);
      set({ graphs: await api.listGraphs(), graph, selectedId: null, dirty: false, measured: {} });
      await refresh(graph, set);
    },

    removeGraph: async (id) => {
      await api.deleteGraph(id);
      const graphs = await api.listGraphs();
      set({ graphs });
      if (get().graph?.id === id) {
        const next = graphs[0];
        if (next) await get().openGraph(next.id);
        else set({ graph: null });
      }
    },

    save: async () => {
      const graph = get().graph;
      if (!graph) return;
      await api.saveGraph(graph);
      set({ dirty: false, graphs: await api.listGraphs() });
    },

    setTab: (tab) => set({ tab }),
    select: (selectedId) => set({ selectedId }),

    setGraph: (graph) => mutate(graph),

    patchGraph: (change) => {
      const graph = get().graph;
      if (graph) mutate({ ...graph, ...change });
    },

    updateNode: (id, change) => {
      const graph = get().graph;
      if (!graph) return;
      mutate({
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...change } : n)),
      });
    },

    updateConfig: (id, change) => {
      const graph = get().graph;
      if (!graph) return;
      mutate({
        ...graph,
        nodes: graph.nodes.map((n) =>
          n.id === id ? { ...n, config: { ...n.config, ...change } as Node["config"] } : n,
        ),
      });
    },

    addNode: (kind, x, y) => {
      const graph = get().graph;
      if (!graph) return;
      const node = makeNode(graph, kind, x, y);
      mutate({ ...graph, nodes: [...graph.nodes, node] });
      set({ selectedId: node.id });
    },

    removeNode: (id) => {
      const graph = get().graph;
      if (!graph) return;
      mutate({
        ...graph,
        nodes: graph.nodes.filter((n) => n.id !== id),
        edges: graph.edges.filter((e) => e.source !== id && e.target !== id),
      });
      if (get().selectedId === id) set({ selectedId: null });
    },

    connect: (source, target, label = "") => {
      const graph = get().graph;
      if (!graph) return;
      const exists = graph.edges.some(
        (e) => e.source === source && e.target === target && e.label === label,
      );
      if (exists) return;
      mutate({ ...graph, edges: [...graph.edges, makeEdge(source, target, label)] });
    },

    disconnect: (edgeId) => {
      const graph = get().graph;
      if (!graph) return;
      mutate({ ...graph, edges: graph.edges.filter((e) => e.id !== edgeId) });
    },

    setModels: async (models) => {
      set({ models: await api.saveModels(models) });
      const graph = get().graph;
      if (graph) await refresh(graph, set);
    },

    recordRun: (events) => {
      const measured: Record<string, RunEvent> = {};
      for (const event of events) {
        if (event.type === "node_done" && event.node_id) measured[event.node_id] = event;
      }
      set({ measured });
    },

    clearMeasured: () => set({ measured: {} }),
  };
});

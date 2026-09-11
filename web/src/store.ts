import { create } from "zustand";
import { api, streamCompile } from "@/lib/api";
import { blankGraph, makeEdge, makeNode, slugify } from "@/lib/graph";
import type { NodeKind } from "@/lib/kinds";
import type {
  AgentGraph,
  CompileResult,
  GraphEstimate,
  Health,
  ModelSpec,
  Node,
  OptimizeResult,
  Problem,
  RunEvent,
  ToolSpec,
} from "@/types/wire";

/** The pages of the home screen. */
export type Section = "workflows" | "templates" | "models" | "settings";

const SECTIONS: readonly Section[] = ["workflows", "templates", "models", "settings"];
const isSection = (value: string): value is Section => SECTIONS.some((s) => s === value);

export type DrawerTab = "code" | "optimize";

/** The last ask for improvements. The list of accepted patches stays in the
 *  panel, so `run` lets the panel start over when a new result lands. */
export type OptimizeState = {
  busy: boolean;
  result: OptimizeResult | null;
  error: string;
  run: number;
};

/** Where a compile has got to. Progress and the finished module live here so
 *  they survive whatever the panels do. */
export type CompileState = {
  running: boolean;
  attempt: number;
  step: "" | "writing" | "checking" | "rejected";
  result: CompileResult | null;
  problems: string[];
  error: string;
  startedAt: number;
};

const IDLE_COMPILE: CompileState = {
  running: false,
  attempt: 0,
  step: "",
  result: null,
  problems: [],
  error: "",
  startedAt: 0,
};

type State = {
  /** The workflow on the canvas. Null shows the home screen. */
  graph: AgentGraph | null;
  graphs: AgentGraph[];
  templates: AgentGraph[];
  models: ModelSpec[];
  tools: ToolSpec[];
  health: Health | null;
  section: Section;
  drawer: { tab: DrawerTab; open: boolean };
  chatOpen: boolean;
  optimize: OptimizeState;
  selectedId: string | null;
  editingId: string | null;
  problems: Problem[];
  estimate: GraphEstimate | null;
  /** Per node id, what the current or last run produced there. */
  measured: Record<string, RunEvent>;
  running: Set<string>;
  skipped: Set<string>;
  /** The stage a stepped run is waiting to start. */
  paused: string | null;
  dirty: boolean;
  error: string;
  compile: CompileState;
};

type Actions = {
  boot: () => Promise<void>;
  openGraph: (id: string) => Promise<void>;
  closeGraph: () => Promise<void>;
  createGraph: () => Promise<void>;
  createFromTemplate: (template: AgentGraph) => Promise<void>;
  duplicateGraph: (id: string) => Promise<void>;
  removeGraph: (id: string) => Promise<void>;
  setSection: (section: Section) => void;
  setDrawer: (tab: DrawerTab, open: boolean) => void;
  toggleChat: () => void;
  runCompile: () => Promise<void>;
  findImprovements: () => Promise<void>;
  clearImprovements: () => void;
  save: () => Promise<void>;
  select: (id: string | null) => void;
  setEditing: (id: string | null) => void;
  setGraph: (graph: AgentGraph) => void;
  patchGraph: (change: Partial<AgentGraph>) => void;
  updateNode: (id: string, change: Partial<Node>) => void;
  moveNodes: (positions: Record<string, { x: number; y: number }>) => void;
  updateConfig: (id: string, change: Record<string, unknown>) => void;
  addNode: (kind: NodeKind, x: number, y: number) => void;
  removeNode: (id: string) => void;
  connect: (source: string, target: string, label?: string) => void;
  disconnect: (edgeId: string) => void;
  setModels: (models: ModelSpec[]) => Promise<void>;
  setRunning: (ids: Set<string>) => void;
  setSkipped: (ids: Set<string>) => void;
  setPaused: (id: string | null) => void;
  recordRun: (events: RunEvent[]) => void;
  setCompile: (change: Partial<CompileState>) => void;
};

/** Validation and pricing both live on the server, so the canvas asks for them
 *  rather than keeping a second opinion. Typing in a prompt changes the price,
 *  so the ask is debounced instead of fired per keystroke. */
let pending: ReturnType<typeof setTimeout> | undefined;

function refresh(graph: AgentGraph, set: (partial: Partial<State>) => void): void {
  clearTimeout(pending);
  pending = setTimeout(async () => {
    try {
      const result = await api.validate(graph);
      set({ problems: result.problems, estimate: result.estimate, error: "" });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  }, 250);
}

// Every edit is saved on its own, a moment after the last keystroke or drag.
let saving: ReturnType<typeof setTimeout> | undefined;

function uniqueId(graphs: AgentGraph[], base: string): string {
  const taken = new Set(graphs.map((g) => g.id));
  let id = base;
  for (let i = 2; taken.has(id); i += 1) id = `${base}_${i}`;
  return id;
}

function uniqueTitle(graphs: AgentGraph[], base: string): string {
  const taken = new Set(graphs.map((g) => g.name));
  let name = base;
  for (let i = 2; taken.has(name); i += 1) name = `${base} ${i}`;
  return name;
}

export const useStore = create<State & Actions>((set, get) => {
  const scheduleSave = () => {
    clearTimeout(saving);
    saving = setTimeout(() => void get().save(), 800);
  };

  const mutate = (next: AgentGraph) => {
    set({ graph: next, dirty: true });
    refresh(next, set);
    scheduleSave();
  };

  // Moving a stage changes neither what the graph does nor what it costs, so a
  // drag never asks the server to validate anything.
  const move = (next: AgentGraph) => {
    set({ graph: next, dirty: true });
    scheduleSave();
  };

  // The open workflow lives in the URL hash, so a reload lands back on it.
  const open = (graph: AgentGraph) => {
    history.replaceState(null, "", `#${graph.id}`);
    set({
      graph,
      selectedId: null,
      editingId: null,
      dirty: false,
      measured: {},
      running: new Set(),
      skipped: new Set(),
      error: "",
      compile: IDLE_COMPILE,
    });
    refresh(graph, set);
  };

  return {
    graph: null,
    graphs: [],
    templates: [],
    models: [],
    tools: [],
    selectedId: null,
    editingId: null,
    problems: [],
    estimate: null,
    measured: {},
    running: new Set(),
    skipped: new Set(),
    paused: null,
    dirty: false,
    error: "",
    compile: IDLE_COMPILE,
    health: null,
    section: "workflows",
    drawer: { tab: "code", open: false },
    chatOpen: false,
    optimize: { busy: false, result: null, error: "", run: 0 },

    boot: async () => {
      const [graphs, templates, models, tools, health] = await Promise.all([
        api.listGraphs(),
        api.templates(),
        api.models(),
        api.tools(),
        api.health(),
      ]);
      set({ graphs, templates, models, tools, health });
      const wanted = location.hash.slice(1);
      if (graphs.some((g) => g.id === wanted)) await get().openGraph(wanted);
      else if (isSection(wanted)) set({ section: wanted });
    },

    setSection: (section) => {
      history.replaceState(null, "", `#${section}`);
      set({ section });
    },
    setDrawer: (tab, open) => set({ drawer: { tab, open } }),
    toggleChat: () => set({ chatOpen: !get().chatOpen }),

    runCompile: async () => {
      const graph = get().graph;
      if (!graph || get().compile.running) return;
      const setCompile = get().setCompile;
      setCompile({
        running: true,
        attempt: 0,
        step: "writing",
        result: null,
        problems: [],
        error: "",
        startedAt: Date.now(),
      });
      set({ drawer: { tab: "code", open: true } });
      try {
        await streamCompile(graph, (event) => {
          if (event.type === "error") setCompile({ error: event.text });
          else if (event.type === "done")
            setCompile({ result: event.result, problems: event.problems });
          else setCompile({ step: event.type, attempt: event.attempt, problems: event.problems });
        });
      } catch (err) {
        setCompile({ error: err instanceof Error ? err.message : String(err) });
      } finally {
        setCompile({ running: false, step: "" });
      }
    },

    findImprovements: async () => {
      const graph = get().graph;
      const prior = get().optimize;
      if (!graph || prior.busy) return;
      set({
        optimize: { busy: true, result: null, error: "", run: prior.run + 1 },
        drawer: { tab: "optimize", open: true },
      });
      try {
        set({ optimize: { ...get().optimize, result: await api.optimize(graph) } });
      } catch (err) {
        set({
          optimize: { ...get().optimize, error: err instanceof Error ? err.message : String(err) },
        });
      } finally {
        set({ optimize: { ...get().optimize, busy: false } });
      }
    },

    clearImprovements: () => {
      const prior = get().optimize;
      set({ optimize: { busy: false, result: null, error: "", run: prior.run + 1 } });
    },

    openGraph: async (id) => {
      open(await api.readGraph(id));
    },

    closeGraph: async () => {
      clearTimeout(saving);
      if (get().dirty) await get().save();
      history.replaceState(null, "", `#${get().section}`);
      set({ graph: null, selectedId: null, editingId: null });
    },

    createGraph: async () => {
      const name = uniqueTitle(get().graphs, "Untitled workflow");
      const graph = blankGraph(uniqueId(get().graphs, slugify(name)), name);
      await api.saveGraph(graph);
      set({ graphs: await api.listGraphs() });
      open(graph);
    },

    // A template or an existing workflow is copied under a fresh id, so editing
    // the copy never touches the original.
    createFromTemplate: async (template) => {
      const graph: AgentGraph = {
        ...template,
        id: uniqueId(get().graphs, template.id),
        name: uniqueTitle(get().graphs, template.name),
      };
      await api.saveGraph(graph);
      set({ graphs: await api.listGraphs() });
      open(graph);
    },

    duplicateGraph: async (id) => {
      const source = get().graphs.find((g) => g.id === id);
      if (source) await get().createFromTemplate(source);
    },

    removeGraph: async (id) => {
      clearTimeout(saving);
      if (get().graph?.id === id) set({ graph: null, dirty: false });
      await api.deleteGraph(id);
      set({ graphs: await api.listGraphs() });
    },

    save: async () => {
      const graph = get().graph;
      if (!graph) return;
      await api.saveGraph(graph);
      set({ dirty: false, graphs: await api.listGraphs() });
    },

    select: (selectedId) => set({ selectedId }),
    setEditing: (editingId) => set({ editingId }),

    setGraph: (graph) => mutate(graph),

    patchGraph: (change) => {
      const graph = get().graph;
      if (graph) mutate({ ...graph, ...change });
    },

    updateNode: (id, change) => {
      const graph = get().graph;
      if (!graph) return;
      const next = {
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === id ? { ...n, ...change } : n)),
      };
      const positionOnly = Object.keys(change).length === 1 && "position" in change;
      if (positionOnly) move(next);
      else mutate(next);
    },

    moveNodes: (positions) => {
      const graph = get().graph;
      if (!graph) return;
      move({
        ...graph,
        nodes: graph.nodes.map((n) => {
          const moved = positions[n.id];
          return moved ? { ...n, position: moved } : n;
        }),
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
      const node = makeNode(graph, kind, x, y, get().models);
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
      if (get().editingId === id) set({ editingId: null });
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
      if (graph) refresh(graph, set);
    },

    setRunning: (running) => set({ running }),
    setSkipped: (skipped) => set({ skipped }),
    setPaused: (paused) => set({ paused }),

    recordRun: (events) => {
      const measured: Record<string, RunEvent> = {};
      for (const event of events) {
        if (event.type === "node_done" && event.node_id) measured[event.node_id] = event;
      }
      set({ measured });
    },

    setCompile: (change) => set({ compile: { ...get().compile, ...change } }),
  };
});

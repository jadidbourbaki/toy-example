import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { upstreamNames } from "@/lib/graph";
import { KIND_LABELS, KIND_TINT } from "@/lib/kinds";
import { useStore } from "@/store";
import type { Route } from "@/types/wire";

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-4">
      <span className="w-24 shrink-0 text-[14px] text-mute">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[14px] text-mute">{label}</div>
      {children}
    </div>
  );
}

/** The stage editor. It opens over the canvas on a double click, holds every
 *  setting the stage has, and closes back to the graph. */
export function StageModal() {
  const graph = useStore((s) => s.graph);
  const editingId = useStore((s) => s.editingId);
  const setEditing = useStore((s) => s.setEditing);
  const models = useStore((s) => s.models);
  const tools = useStore((s) => s.tools);
  const graphs = useStore((s) => s.graphs);
  const problems = useStore((s) => s.problems);
  const updateNode = useStore((s) => s.updateNode);
  const updateConfig = useStore((s) => s.updateConfig);
  const removeNode = useStore((s) => s.removeNode);

  const node = graph?.nodes.find((n) => n.id === editingId);
  if (!graph || !node) return null;

  const config = node.config;
  const boundary = config.kind === "input" || config.kind === "output";
  const nodeProblems = problems.filter((p) => p.node_id === node.id);
  const available = ["input", ...upstreamNames(graph, node.id)];

  return (
    <Dialog.Root open onOpenChange={(open) => !open && setEditing(null)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/25" />
        <Dialog.Content className="fixed top-1/2 left-1/2 flex max-h-[82vh] w-[600px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl">
          <div className="flex items-center gap-3 border-b border-line px-6 py-4">
            <span className="text-[14px] font-medium" style={{ color: KIND_TINT[config.kind] }}>
              {KIND_LABELS[config.kind]}
            </span>
            <Dialog.Title className="flex-1 truncate text-[17px] font-medium">
              {node.name}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="btn-quiet" aria-label="Close">
                <X size={17} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
            <Prop label="Name">
              <input
                className="field"
                value={node.name}
                onChange={(e) => updateNode(node.id, { name: e.target.value })}
              />
            </Prop>

            {"stage" in config && (
              <Prop label="Stage">
                <input
                  className="field"
                  value={config.stage}
                  onChange={(e) => updateConfig(node.id, { stage: e.target.value })}
                />
              </Prop>
            )}

            {"model" in config && (
              <Prop label="Model">
                <select
                  className="field"
                  value={config.model}
                  onChange={(e) => updateConfig(node.id, { model: e.target.value })}
                >
                  {!config.model && <option value="">Pick a model</option>}
                  {models.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.label}
                    </option>
                  ))}
                </select>
              </Prop>
            )}

            {config.kind === "tool" && (
              <Prop label="Function">
                <select
                  className="field"
                  value={config.tool}
                  onChange={(e) => updateConfig(node.id, { tool: e.target.value })}
                >
                  {tools.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.id}
                    </option>
                  ))}
                </select>
              </Prop>
            )}

            {config.kind === "tool" &&
              tools
                .filter((t) => t.id === config.tool)
                .map((tool) => (
                  <p key={tool.id} className="pl-28 text-[13px] text-faint">
                    {tool.description}
                  </p>
                ))}

            {config.kind === "react" && (
              <Prop label="Tool budget">
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="field num w-28"
                  value={config.max_iterations}
                  onChange={(e) =>
                    updateConfig(node.id, { max_iterations: Number(e.target.value) || 1 })
                  }
                />
              </Prop>
            )}

            {config.kind === "subagent" && (
              <Prop label="Agent">
                <select
                  className="field"
                  value={config.graph_id}
                  onChange={(e) => updateConfig(node.id, { graph_id: e.target.value })}
                >
                  <option value="">Pick an agent</option>
                  {graphs
                    .filter((g) => g.id !== graph.id)
                    .map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                </select>
              </Prop>
            )}

            {config.kind === "react" && (
              <Block label="Tools">
                <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                  {tools.map((tool) => {
                    const on = config.tools.includes(tool.id);
                    return (
                      <label key={tool.id} className="flex cursor-pointer items-center gap-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            updateConfig(node.id, {
                              tools: on
                                ? config.tools.filter((t) => t !== tool.id)
                                : [...config.tools, tool.id],
                            })
                          }
                        />
                        <span className="font-mono text-[13px]">{tool.id}</span>
                      </label>
                    );
                  })}
                </div>
              </Block>
            )}

            {config.kind === "router" && (
              <Block label="Question">
                <textarea
                  className="field h-16 resize-none"
                  value={config.question}
                  onChange={(e) => updateConfig(node.id, { question: e.target.value })}
                />
              </Block>
            )}

            {"instructions" in config && (
              <Block label="Instructions">
                <textarea
                  className="field h-24 resize-none leading-relaxed"
                  value={config.instructions}
                  onChange={(e) => updateConfig(node.id, { instructions: e.target.value })}
                />
              </Block>
            )}

            {"prompt" in config && (
              <Block label="Prompt">
                <textarea
                  className="field h-20 resize-none font-mono text-[13px] leading-relaxed"
                  value={config.prompt}
                  onChange={(e) => updateConfig(node.id, { prompt: e.target.value })}
                />
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {available.map((name) => (
                    <button
                      key={name}
                      className="rounded-md border border-line px-2 py-0.5 font-mono text-[12px] text-mute hover:border-accent hover:text-accent"
                      onClick={() =>
                        updateConfig(node.id, { prompt: `${config.prompt}\${${name}}` })
                      }
                    >
                      {name}
                    </button>
                  ))}
                </div>
              </Block>
            )}

            {config.kind === "router" && (
              <Block label="Routes">
                {config.routes.map((route: Route, index: number) => (
                  <div key={index} className="mb-2 flex items-center gap-2">
                    <input
                      className="field w-32 shrink-0"
                      value={route.label}
                      onChange={(e) => {
                        const routes = [...config.routes];
                        routes[index] = { ...route, label: e.target.value };
                        updateConfig(node.id, { routes });
                      }}
                    />
                    <input
                      className="field"
                      placeholder="When it applies"
                      value={route.description}
                      onChange={(e) => {
                        const routes = [...config.routes];
                        routes[index] = { ...route, description: e.target.value };
                        updateConfig(node.id, { routes });
                      }}
                    />
                    <button
                      className="btn-quiet shrink-0"
                      onClick={() =>
                        updateConfig(node.id, {
                          routes: config.routes.filter((_, i) => i !== index),
                        })
                      }
                      title="Remove this route"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button
                  className="text-[14px] text-mute hover:text-accent"
                  onClick={() =>
                    updateConfig(node.id, {
                      routes: [
                        ...config.routes,
                        { label: `route_${config.routes.length + 1}`, description: "" },
                      ],
                    })
                  }
                >
                  Add a route
                </button>
              </Block>
            )}

            {boundary && (
              <Block label="Description">
                <textarea
                  className="field h-16 resize-none"
                  value={config.description}
                  onChange={(e) => updateConfig(node.id, { description: e.target.value })}
                />
              </Block>
            )}

            {nodeProblems.map((problem, index) => (
              <p
                key={index}
                className={cn(
                  "text-[14px] leading-snug",
                  problem.severity === "error" ? "text-bad" : "text-warn",
                )}
              >
                {problem.message}
              </p>
            ))}
          </div>

          <div className="flex items-center border-t border-line px-6 py-3.5">
            {!boundary && (
              <button
                className="text-[14px] text-mute hover:text-bad"
                onClick={() => {
                  removeNode(node.id);
                  setEditing(null);
                }}
              >
                Remove stage
              </button>
            )}
            <div className="flex-1" />
            <Dialog.Close asChild>
              <button className="btn btn-primary">Done</button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { upstreamNames } from "@/lib/graph";
import { KIND_LABELS } from "@/lib/kinds";
import { useStore } from "@/store";
import type { Node, Route } from "@/types/wire";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <div className="mb-1 text-[13px] text-faint">{label}</div>
      {children}
    </div>
  );
}

export function Inspector() {
  const graph = useStore((s) => s.graph);
  const selectedId = useStore((s) => s.selectedId);
  const models = useStore((s) => s.models);
  const tools = useStore((s) => s.tools);
  const graphs = useStore((s) => s.graphs);
  const problems = useStore((s) => s.problems);
  const updateNode = useStore((s) => s.updateNode);
  const updateConfig = useStore((s) => s.updateConfig);
  const removeNode = useStore((s) => s.removeNode);
  const patchGraph = useStore((s) => s.patchGraph);

  const node: Node | undefined = graph?.nodes.find((n) => n.id === selectedId);

  if (!graph) return <aside className="w-72 shrink-0 border-l border-line bg-panel" />;

  if (!node) {
    return (
      <aside className="w-72 shrink-0 overflow-y-auto border-l border-line bg-panel p-3">
        <Row label="Name">
          <input
            className="field"
            value={graph.name}
            onChange={(e) => patchGraph({ name: e.target.value })}
          />
        </Row>
        <Row label="Description">
          <textarea
            className="field h-20 resize-none"
            value={graph.description}
            onChange={(e) => patchGraph({ description: e.target.value })}
          />
        </Row>
        <Row label="Identifier">
          <div className="num text-[12px] text-mute">{graph.id}</div>
        </Row>
      </aside>
    );
  }

  const config = node.config;
  const nodeProblems = problems.filter((p) => p.node_id === node.id);
  const available = ["input", ...upstreamNames(graph, node.id)];

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-line bg-panel">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="flex-1 text-[13px] text-faint">{KIND_LABELS[config.kind]}</span>
        {config.kind !== "input" && config.kind !== "output" && (
          <button
            className="text-faint hover:text-bad"
            onClick={() => removeNode(node.id)}
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="p-3">
        <Row label="Name">
          <input
            className="field"
            value={node.name}
            onChange={(e) => updateNode(node.id, { name: e.target.value })}
          />
        </Row>

        {"stage" in config && (
          <Row label="Stage">
            <input
              className="field"
              value={config.stage}
              onChange={(e) => updateConfig(node.id, { stage: e.target.value })}
            />
          </Row>
        )}

        {"model" in config && (
          <Row label="Model">
            <select
              className="field"
              value={config.model}
              onChange={(e) => updateConfig(node.id, { model: e.target.value })}
            >
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label || model.model}
                </option>
              ))}
            </select>
            {models
              .filter((m) => m.id === config.model)
              .map((m) => (
                <div key={m.id} className="num mt-1 text-[11px] text-faint">
                  ${m.input_usd_per_mtok} in · ${m.output_usd_per_mtok} out per Mtok
                </div>
              ))}
          </Row>
        )}

        {"instructions" in config && (
          <Row label="Instructions">
            <textarea
              className="field h-24 resize-none leading-relaxed"
              value={config.instructions}
              onChange={(e) => updateConfig(node.id, { instructions: e.target.value })}
            />
          </Row>
        )}

        {config.kind === "router" && (
          <Row label="Question">
            <textarea
              className="field h-16 resize-none"
              value={config.question}
              onChange={(e) => updateConfig(node.id, { question: e.target.value })}
            />
          </Row>
        )}

        {"prompt" in config && (
          <Row label="Prompt">
            <textarea
              className="field h-24 resize-none font-mono text-[12px] leading-relaxed"
              value={config.prompt}
              onChange={(e) => updateConfig(node.id, { prompt: e.target.value })}
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {available.map((name) => (
                <button
                  key={name}
                  className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px] text-mute hover:border-accent hover:text-accent"
                  onClick={() => updateConfig(node.id, { prompt: `${config.prompt}\${${name}}` })}
                >
                  ${"{"}
                  {name}
                  {"}"}
                </button>
              ))}
            </div>
          </Row>
        )}

        {config.kind === "tool" && (
          <>
            <Row label="Tool">
              <select
                className="field"
                value={config.tool}
                onChange={(e) => updateConfig(node.id, { tool: e.target.value })}
              >
                {tools.map((tool) => (
                  <option key={tool.id} value={tool.id}>
                    {tool.label}
                  </option>
                ))}
              </select>
            </Row>
            {tools
              .filter((t) => t.id === config.tool)
              .map((tool) => (
                <Row key={tool.id} label="Arguments">
                  {tool.parameters.map((parameter) => (
                    <div key={parameter} className="mb-1.5">
                      <div className="mb-0.5 font-mono text-[11px] text-faint">{parameter}</div>
                      <input
                        className="field font-mono text-[12px]"
                        value={config.arguments[parameter] ?? ""}
                        onChange={(e) =>
                          updateConfig(node.id, {
                            arguments: { ...config.arguments, [parameter]: e.target.value },
                          })
                        }
                      />
                    </div>
                  ))}
                </Row>
              ))}
          </>
        )}

        {config.kind === "react" && (
          <>
            <Row label="Tools">
              {tools.map((tool) => {
                const on = config.tools.includes(tool.id);
                return (
                  <label
                    key={tool.id}
                    className="mb-1 flex cursor-pointer items-center gap-2 text-[12px]"
                  >
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
                    {tool.label}
                  </label>
                );
              })}
            </Row>
            <Row label="Tool budget">
              <input
                type="number"
                min={1}
                max={20}
                className="field num"
                value={config.max_iterations}
                onChange={(e) =>
                  updateConfig(node.id, { max_iterations: Number(e.target.value) || 1 })
                }
              />
            </Row>
          </>
        )}

        {config.kind === "router" && (
          <Row label="Routes">
            {config.routes.map((route: Route, index: number) => (
              <div key={index} className="mb-1.5 rounded border border-line p-1.5">
                <input
                  className="field mb-1 text-[12px]"
                  value={route.label}
                  onChange={(e) => {
                    const routes = [...config.routes];
                    routes[index] = { ...route, label: e.target.value };
                    updateConfig(node.id, { routes });
                  }}
                />
                <input
                  className="field text-[12px]"
                  placeholder="When this branch applies"
                  value={route.description}
                  onChange={(e) => {
                    const routes = [...config.routes];
                    routes[index] = { ...route, description: e.target.value };
                    updateConfig(node.id, { routes });
                  }}
                />
                <button
                  className="mt-1 text-[11px] text-faint hover:text-bad"
                  onClick={() =>
                    updateConfig(node.id, { routes: config.routes.filter((_, i) => i !== index) })
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              className="btn w-full justify-center text-[12px]"
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
          </Row>
        )}

        {config.kind === "subagent" && (
          <Row label="Agent">
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
          </Row>
        )}

        {(config.kind === "input" || config.kind === "output") && (
          <Row label="Description">
            <textarea
              className="field h-16 resize-none"
              value={config.description}
              onChange={(e) => updateConfig(node.id, { description: e.target.value })}
            />
          </Row>
        )}

        {nodeProblems.map((problem, index) => (
          <div
            key={index}
            className={cn(
              "mt-2 text-[12px] leading-snug",
              problem.severity === "error" ? "text-bad" : "text-warn",
            )}
          >
            {problem.message}
          </div>
        ))}
      </div>
    </aside>
  );
}

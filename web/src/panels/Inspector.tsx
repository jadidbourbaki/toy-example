import { Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { upstreamNames } from "@/lib/graph";
import { KINDS } from "@/lib/kinds";
import { useStore } from "@/store";
import type { Node, Route } from "@/types/wire";

function Label({ children }: { children: React.ReactNode }) {
  return <div className="eyebrow mb-1">{children}</div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <Label>{label}</Label>
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

  if (!graph) return <aside className="w-80 shrink-0 border-l border-line bg-slate" />;

  if (!node) {
    return (
      <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-slate p-3">
        <Row label="Graph name">
          <input
            className="field"
            value={graph.name}
            onChange={(e) => patchGraph({ name: e.target.value })}
          />
        </Row>
        <Row label="What it does">
          <textarea
            className="field h-20 resize-none"
            placeholder="One sentence. It becomes the generated module's docstring."
            value={graph.description}
            onChange={(e) => patchGraph({ description: e.target.value })}
          />
        </Row>
        <Row label="Identifier">
          <div className="ident text-[12px] text-mute">{graph.id}</div>
        </Row>
        <div className="mt-2 border-t border-line pt-3 text-[12px] leading-relaxed text-mute">
          Pick a stage to edit it. Drag from a stage's right edge to another stage's left edge to
          pass its output along.
        </div>
      </aside>
    );
  }

  const config = node.config;
  const meta = KINDS[config.kind];
  const nodeProblems = problems.filter((p) => p.node_id === node.id);
  const available = ["input", ...upstreamNames(graph, node.id)];

  return (
    <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l border-line bg-slate">
      <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
        <span className="h-3.5 w-[3px] rounded-[1px]" style={{ background: meta.color }} />
        <span className="eyebrow flex-1" style={{ color: meta.color }}>
          {meta.label}
        </span>
        {config.kind !== "input" && config.kind !== "output" && (
          <button
            className="text-faint hover:text-bad"
            onClick={() => removeNode(node.id)}
            title="Delete this stage"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="p-3">
        <Row label="Name">
          <input
            className="field ident"
            value={node.name}
            onChange={(e) => updateNode(node.id, { name: e.target.value })}
          />
          <div className="mt-1 text-[10px] text-faint">
            Downstream stages read this stage as{" "}
            <span className="ident text-mute">
              ${"{"}
              {node.name}
              {"}"}
            </span>
            .
          </div>
        </Row>

        {"stage" in config && (
          <Row label="Stage">
            <input
              className="field ident"
              value={config.stage}
              onChange={(e) => updateConfig(node.id, { stage: e.target.value })}
            />
            <div className="mt-1 text-[10px] leading-snug text-faint">
              What the call is for. Stages sharing a name share one model binding in the generated
              code.
            </div>
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
                <div key={m.id} className="num mt-1 text-[10px] text-faint">
                  ${m.input_usd_per_mtok}/Mtok in · ${m.output_usd_per_mtok}/Mtok out · quality{" "}
                  {m.quality_prior}
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
              className="field ident h-24 resize-none text-[12px] leading-relaxed"
              value={config.prompt}
              onChange={(e) => updateConfig(node.id, { prompt: e.target.value })}
            />
            <div className="mt-1 flex flex-wrap gap-1">
              {available.map((name) => (
                <button
                  key={name}
                  className="ident rounded-[2px] border border-line px-1 py-0.5 text-[10px] text-mute hover:border-kind-llm hover:text-kind-llm"
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
                      <div className="ident mb-0.5 text-[10px] text-faint">{parameter}</div>
                      <input
                        className="field ident text-[12px]"
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
                  <button
                    key={tool.id}
                    onClick={() =>
                      updateConfig(node.id, {
                        tools: on
                          ? config.tools.filter((t) => t !== tool.id)
                          : [...config.tools, tool.id],
                      })
                    }
                    className={cn(
                      "mb-1 flex w-full items-center gap-2 rounded-[3px] border px-2 py-1 text-left",
                      on
                        ? "border-kind-react/60 bg-kind-react/10 text-chalk"
                        : "border-line text-mute hover:border-faint",
                    )}
                  >
                    <span className="ident text-[11px]">{tool.id}</span>
                  </button>
                );
              })}
            </Row>
            <Row label="Iteration cap">
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
              <div className="mt-1 text-[10px] leading-snug text-faint">
                The loop stops here even when it has not finished. A cap it rarely reaches is a cap
                you are paying for.
              </div>
            </Row>
          </>
        )}

        {config.kind === "router" && (
          <Row label="Routes">
            {config.routes.map((route: Route, index: number) => (
              <div key={index} className="mb-1.5 rounded-[3px] border border-line p-1.5">
                <input
                  className="field ident mb-1 text-[12px]"
                  value={route.label}
                  onChange={(e) => {
                    const routes = [...config.routes];
                    routes[index] = { ...route, label: e.target.value };
                    updateConfig(node.id, { routes });
                  }}
                />
                <input
                  className="field text-[12px]"
                  placeholder="When does this branch apply?"
                  value={route.description}
                  onChange={(e) => {
                    const routes = [...config.routes];
                    routes[index] = { ...route, description: e.target.value };
                    updateConfig(node.id, { routes });
                  }}
                />
                <button
                  className="mt-1 text-[10px] text-faint hover:text-bad"
                  onClick={() =>
                    updateConfig(node.id, {
                      routes: config.routes.filter((_, i) => i !== index),
                    })
                  }
                >
                  Remove route
                </button>
              </div>
            ))}
            <button
              className="btn w-full justify-center text-[11px]"
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
          <Row label="Graph to call">
            <select
              className="field"
              value={config.graph_id}
              onChange={(e) => updateConfig(node.id, { graph_id: e.target.value })}
            >
              <option value="">Pick a graph</option>
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

        {nodeProblems.length > 0 && (
          <div className="mt-1 border-t border-line pt-3">
            {nodeProblems.map((problem, index) => (
              <div
                key={index}
                className={cn(
                  "mb-1.5 rounded-[3px] border-l-2 py-0.5 pl-2 text-[11px] leading-snug",
                  problem.severity === "error" ? "border-bad text-bad" : "border-warn text-warn",
                )}
              >
                {problem.message}
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

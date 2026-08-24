import { cn } from "@/lib/cn";
import { upstreamNames } from "@/lib/graph";
import { KIND_LABELS, KIND_TINT } from "@/lib/kinds";
import { useStore } from "@/store";
import type { Node, Route } from "@/types/wire";

/** A compact property: label on the left, control on the right. Most of what a
 *  stage carries is one short value, and stacking a heading above every one of
 *  them is what makes a panel read as a pile. */
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-h-9 items-center gap-3 px-4">
      <span className="w-20 shrink-0 text-[13px] text-mute">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}

/** A property whose value needs room: prompts, instructions, descriptions. */
function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-2">
      <div className="mb-1.5 text-[13px] text-mute">{label}</div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="my-2 border-t border-line" />;
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
  const patchGraph = useStore((s) => s.patchGraph);

  const node: Node | undefined = graph?.nodes.find((n) => n.id === selectedId);

  if (!graph) return <aside className="w-[300px] shrink-0 border-l border-line" />;

  if (!node) {
    return (
      <aside className="w-[300px] shrink-0 overflow-y-auto border-l border-line py-3">
        <Prop label="Name">
          <input
            className="field py-1"
            value={graph.name}
            onChange={(e) => patchGraph({ name: e.target.value })}
          />
        </Prop>
        <Block label="Description">
          <textarea
            className="field h-20 resize-none"
            value={graph.description}
            onChange={(e) => patchGraph({ description: e.target.value })}
          />
        </Block>
        <Prop label="Stages">
          <span className="num text-[13px] text-mute">{graph.nodes.length}</span>
        </Prop>
      </aside>
    );
  }

  const config = node.config;
  const nodeProblems = problems.filter((p) => p.node_id === node.id);
  const available = ["input", ...upstreamNames(graph, node.id)];

  return (
    <aside className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-l border-line">
      <div className="flex items-center gap-2 px-4 pt-3.5 pb-1">
        <span className="h-2 w-2 rounded-full" style={{ background: KIND_TINT[config.kind] }} />
        <span className="text-[13px] font-medium" style={{ color: KIND_TINT[config.kind] }}>
          {KIND_LABELS[config.kind]}
        </span>
      </div>

      <div className="pb-3">
        <Prop label="Name">
          <input
            className="field py-1"
            value={node.name}
            onChange={(e) => updateNode(node.id, { name: e.target.value })}
          />
        </Prop>

        {"stage" in config && (
          <Prop label="Stage">
            <input
              className="field py-1"
              value={config.stage}
              onChange={(e) => updateConfig(node.id, { stage: e.target.value })}
            />
          </Prop>
        )}

        {"model" in config && (
          <>
            <Prop label="Model">
              <select
                className="field py-1"
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
            {models
              .filter((m) => m.id === config.model)
              .map((m) => (
                <div key={m.id} className="num px-4 pb-1 pl-[92px] text-[12px] text-faint">
                  ${m.input_usd_per_mtok} in, ${m.output_usd_per_mtok} out per million
                </div>
              ))}
          </>
        )}

        {config.kind === "tool" && (
          <Prop label="Function">
            <select
              className="field py-1"
              value={config.tool}
              onChange={(e) => updateConfig(node.id, { tool: e.target.value })}
            >
              {tools.map((tool) => (
                <option key={tool.id} value={tool.id}>
                  {tool.label}
                </option>
              ))}
            </select>
          </Prop>
        )}

        {config.kind === "react" && (
          <Prop label="Tool budget">
            <input
              type="number"
              min={1}
              max={20}
              className="field num py-1"
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
              className="field py-1"
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

        {("instructions" in config || "prompt" in config) && <Divider />}

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
              className="field h-24 resize-none font-mono text-[13px] leading-relaxed"
              value={config.prompt}
              onChange={(e) => updateConfig(node.id, { prompt: e.target.value })}
            />
            <div className="mt-1.5 flex flex-wrap gap-1">
              {available.map((name) => (
                <button
                  key={name}
                  className="rounded-md border border-line px-1.5 py-0.5 font-mono text-[12px] text-mute hover:border-accent hover:text-accent"
                  onClick={() => updateConfig(node.id, { prompt: `${config.prompt}\${${name}}` })}
                >
                  {name}
                </button>
              ))}
            </div>
          </Block>
        )}

        {config.kind === "react" && (
          <>
            <Divider />
            <Block label="Tools">
              {tools.map((tool) => {
                const on = config.tools.includes(tool.id);
                return (
                  <label key={tool.id} className="mb-1 flex cursor-pointer items-center gap-2">
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
                    <span className="text-[14px]">{tool.label}</span>
                  </label>
                );
              })}
            </Block>
          </>
        )}

        {config.kind === "router" && (
          <>
            <Divider />
            <Block label="Routes">
              {config.routes.map((route: Route, index: number) => (
                <div key={index} className="mb-2 flex items-center gap-2">
                  <input
                    className="field w-24 shrink-0 py-1"
                    value={route.label}
                    onChange={(e) => {
                      const routes = [...config.routes];
                      routes[index] = { ...route, label: e.target.value };
                      updateConfig(node.id, { routes });
                    }}
                  />
                  <input
                    className="field py-1"
                    placeholder="When it applies"
                    value={route.description}
                    onChange={(e) => {
                      const routes = [...config.routes];
                      routes[index] = { ...route, description: e.target.value };
                      updateConfig(node.id, { routes });
                    }}
                  />
                </div>
              ))}
              <button
                className="text-[13px] text-mute hover:text-accent"
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
          </>
        )}

        {(config.kind === "input" || config.kind === "output") && (
          <Block label="Description">
            <textarea
              className="field h-16 resize-none"
              value={config.description}
              onChange={(e) => updateConfig(node.id, { description: e.target.value })}
            />
          </Block>
        )}

        {nodeProblems.length > 0 && (
          <div className="mt-1 px-4">
            {nodeProblems.map((problem, index) => (
              <p
                key={index}
                className={cn(
                  "mb-1 text-[13px] leading-snug",
                  problem.severity === "error" ? "text-bad" : "text-warn",
                )}
              >
                {problem.message}
              </p>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

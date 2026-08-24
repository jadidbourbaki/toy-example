import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { upstreamNames } from "@/lib/graph";
import { KIND_LABELS, KIND_TINT } from "@/lib/kinds";
import { useStore } from "@/store";
import type { Route } from "@/types/wire";

/** Label and control on one line, both at the library's own size so they sit
 *  on a shared baseline. */
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-center gap-4">
      <Label className="text-muted-foregroundd-foreground">{label}</Label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="text-muted-foregroundd-foreground">{label}</Label>
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
    <Dialog open onOpenChange={(open) => !open && setEditing(null)}>
      <DialogContent className="flex max-h-[82vh] flex-col gap-0 p-0 sm:max-w-[620px]">
        <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4">
          <span className="font-medium" style={{ color: KIND_TINT[config.kind] }}>
            {KIND_LABELS[config.kind]}
          </span>
          <DialogTitle className="flex-1 truncate text-lg">{node.name}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <Prop label="Name">
            <Input
              value={node.name}
              onChange={(e) => updateNode(node.id, { name: e.target.value })}
            />
          </Prop>

          {"stage" in config && (
            <Prop label="Stage">
              <Input
                value={config.stage}
                onChange={(e) => updateConfig(node.id, { stage: e.target.value })}
              />
            </Prop>
          )}

          {"model" in config && (
            <Prop label="Model">
              <Select
                value={config.model}
                onValueChange={(value) => updateConfig(node.id, { model: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a model" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Prop>
          )}

          {config.kind === "tool" && (
            <Prop label="Function">
              <Select
                value={config.tool}
                onValueChange={(value) => updateConfig(node.id, { tool: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tools.map((tool) => (
                    <SelectItem key={tool.id} value={tool.id}>
                      {tool.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Prop>
          )}

          {config.kind === "react" && (
            <Prop label="Tool budget">
              <Input
                type="number"
                min={1}
                max={20}
                className="num w-28"
                value={config.max_iterations}
                onChange={(e) =>
                  updateConfig(node.id, { max_iterations: Number(e.target.value) || 1 })
                }
              />
            </Prop>
          )}

          {config.kind === "subagent" && (
            <Prop label="Agent">
              <Select
                value={config.graph_id}
                onValueChange={(value) => updateConfig(node.id, { graph_id: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick an agent" />
                </SelectTrigger>
                <SelectContent>
                  {graphs
                    .filter((g) => g.id !== graph.id)
                    .map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Prop>
          )}

          {config.kind === "react" && (
            <Block label="Tools">
              <div className="flex flex-wrap gap-x-6 gap-y-2.5">
                {tools.map((tool) => (
                  <Label key={tool.id} className="font-mono font-normal">
                    <Checkbox
                      checked={config.tools.includes(tool.id)}
                      onCheckedChange={(on) =>
                        updateConfig(node.id, {
                          tools: on
                            ? [...config.tools, tool.id]
                            : config.tools.filter((t) => t !== tool.id),
                        })
                      }
                    />
                    {tool.id}
                  </Label>
                ))}
              </div>
            </Block>
          )}

          {config.kind === "router" && (
            <Block label="Question">
              <Textarea
                className="h-16 resize-none"
                value={config.question}
                onChange={(e) => updateConfig(node.id, { question: e.target.value })}
              />
            </Block>
          )}

          {"instructions" in config && (
            <Block label="Instructions">
              <Textarea
                className="h-24 resize-none"
                value={config.instructions}
                onChange={(e) => updateConfig(node.id, { instructions: e.target.value })}
              />
            </Block>
          )}

          {"prompt" in config && (
            <Block label="Prompt">
              <Textarea
                className="h-24 resize-none font-mono"
                value={config.prompt}
                onChange={(e) => updateConfig(node.id, { prompt: e.target.value })}
              />
              <div className="flex flex-wrap gap-1.5">
                {available.map((name) => (
                  <Button
                    key={name}
                    variant="outline"
                    size="sm"
                    className="font-mono"
                    onClick={() => updateConfig(node.id, { prompt: `${config.prompt}\${${name}}` })}
                  >
                    {name}
                  </Button>
                ))}
              </div>
            </Block>
          )}

          {config.kind === "router" && (
            <Block label="Routes">
              {config.routes.map((route: Route, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    className="w-36 shrink-0"
                    value={route.label}
                    onChange={(e) => {
                      const routes = [...config.routes];
                      routes[index] = { ...route, label: e.target.value };
                      updateConfig(node.id, { routes });
                    }}
                  />
                  <Input
                    placeholder="When it applies"
                    value={route.description}
                    onChange={(e) => {
                      const routes = [...config.routes];
                      routes[index] = { ...route, description: e.target.value };
                      updateConfig(node.id, { routes });
                    }}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      updateConfig(node.id, {
                        routes: config.routes.filter((_, i) => i !== index),
                      })
                    }
                    aria-label="Remove this route"
                  >
                    <X />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="self-start"
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
              </Button>
            </Block>
          )}

          {boundary && (
            <Block label="Description">
              <Textarea
                className="h-16 resize-none"
                value={config.description}
                onChange={(e) => updateConfig(node.id, { description: e.target.value })}
              />
            </Block>
          )}

          {nodeProblems.map((problem, index) => (
            <p
              key={index}
              className={cn(
                "leading-snug",
                problem.severity === "error"
                  ? "text-destructive"
                  : "text-muted-foregroundd-foreground",
              )}
            >
              {problem.message}
            </p>
          ))}
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-between">
          {!boundary ? (
            <Button
              variant="ghost"
              className="text-muted-foregroundd-foreground hover:text-destructive"
              onClick={() => {
                removeNode(node.id);
                setEditing(null);
              }}
            >
              Remove stage
            </Button>
          ) : (
            <span />
          )}
          <Button onClick={() => setEditing(null)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

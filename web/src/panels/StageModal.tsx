import {
  Button,
  Checkbox,
  Dialog,
  Flex,
  Select,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { X } from "lucide-react";
import { upstreamNames } from "@/lib/graph";
import { KIND_LABELS, KIND_TINT } from "@/lib/kinds";
import { useStore } from "@/store";
import type { Route } from "@/types/wire";

/** Label and control on one line. Both sizes come from the theme scale, so they
 *  share a baseline without anything being chosen by hand. */
function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex align="center" gap="4">
      <Text size="2" color="gray" style={{ width: 128, flexShrink: 0 }}>
        {label}
      </Text>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </Flex>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex direction="column" gap="2">
      <Text size="2" color="gray">
        {label}
      </Text>
      {children}
    </Flex>
  );
}

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
    <Dialog.Root open onOpenChange={(open: boolean) => !open && setEditing(null)}>
      <Dialog.Content maxWidth="620px">
        <Flex align="center" gap="3">
          <Text size="2" weight="medium" style={{ color: KIND_TINT[config.kind] }}>
            {KIND_LABELS[config.kind]}
          </Text>
          <Dialog.Title size="4" mb="0" truncate style={{ flex: 1 }}>
            {node.name}
          </Dialog.Title>
        </Flex>

        <Flex direction="column" gap="4" mt="5" style={{ maxHeight: "60vh", overflowY: "auto" }}>
          <Prop label="Name">
            <TextField.Root
              value={node.name}
              onChange={(e) => updateNode(node.id, { name: e.target.value })}
            />
          </Prop>

          {"stage" in config && (
            <Prop label="Stage">
              <TextField.Root
                value={config.stage}
                onChange={(e) => updateConfig(node.id, { stage: e.target.value })}
              />
            </Prop>
          )}

          {"model" in config && (
            <Prop label="Model">
              <Select.Root
                value={config.model || undefined}
                onValueChange={(value) => updateConfig(node.id, { model: value })}
              >
                <Select.Trigger placeholder="Pick a model" style={{ width: "100%" }} />
                <Select.Content>
                  {models.map((model) => (
                    <Select.Item key={model.id} value={model.id}>
                      {model.label}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Prop>
          )}

          {config.kind === "tool" && (
            <Prop label="Function">
              <Select.Root
                value={config.tool}
                onValueChange={(value) => updateConfig(node.id, { tool: value })}
              >
                <Select.Trigger style={{ width: "100%" }} />
                <Select.Content>
                  {tools.map((tool) => (
                    <Select.Item key={tool.id} value={tool.id}>
                      {tool.id}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Prop>
          )}

          {(config.kind === "judge" || config.kind === "approve") && (
            <Prop label="Tries">
              <TextField.Root
                type="number"
                min="1"
                max="5"
                className="num"
                style={{ width: 120 }}
                value={String(config.max_rounds)}
                onChange={(e) => updateConfig(node.id, { max_rounds: Number(e.target.value) || 1 })}
              />
            </Prop>
          )}

          {config.kind === "react" && (
            <Prop label="Tool calls">
              <TextField.Root
                type="number"
                min="1"
                max="20"
                className="num"
                style={{ width: 120 }}
                value={String(config.max_iterations)}
                onChange={(e) =>
                  updateConfig(node.id, { max_iterations: Number(e.target.value) || 1 })
                }
              />
            </Prop>
          )}

          {config.kind === "subagent" && (
            <Prop label="Workflow">
              <Select.Root
                value={config.graph_id || undefined}
                onValueChange={(value) => updateConfig(node.id, { graph_id: value })}
              >
                <Select.Trigger placeholder="Pick a workflow" style={{ width: "100%" }} />
                <Select.Content>
                  {graphs
                    .filter((g) => g.id !== graph.id)
                    .map((g) => (
                      <Select.Item key={g.id} value={g.id}>
                        {g.name}
                      </Select.Item>
                    ))}
                </Select.Content>
              </Select.Root>
            </Prop>
          )}

          {config.kind === "react" && (
            <Block label="Tools">
              <Flex gap="5" wrap="wrap">
                {tools.map((tool) => (
                  <Text key={tool.id} as="label" size="2">
                    <Flex gap="2" align="center">
                      <Checkbox
                        checked={config.tools.includes(tool.id)}
                        onCheckedChange={(on: boolean | "indeterminate") =>
                          updateConfig(node.id, {
                            tools: on
                              ? [...config.tools, tool.id]
                              : config.tools.filter((t) => t !== tool.id),
                          })
                        }
                      />
                      <span className="num">{tool.id}</span>
                    </Flex>
                  </Text>
                ))}
              </Flex>
            </Block>
          )}

          {config.kind === "judge" && (
            <Block label="What a good answer has to satisfy">
              <TextArea
                rows={3}
                value={config.criteria}
                onChange={(e) => updateConfig(node.id, { criteria: e.target.value })}
              />
            </Block>
          )}

          {(config.kind === "router" || config.kind === "approve") && (
            <Block label="Question">
              <TextArea
                rows={2}
                value={config.question}
                onChange={(e) => updateConfig(node.id, { question: e.target.value })}
              />
            </Block>
          )}

          {"instructions" in config && (
            <Block label="Instructions">
              <TextArea
                rows={3}
                value={config.instructions}
                onChange={(e) => updateConfig(node.id, { instructions: e.target.value })}
              />
            </Block>
          )}

          {"prompt" in config && (
            <Block label="Prompt">
              <TextArea
                rows={3}
                className="num"
                value={config.prompt}
                onChange={(e) => updateConfig(node.id, { prompt: e.target.value })}
              />
              <Flex gap="2" wrap="wrap">
                {available.map((name) => (
                  <Button
                    key={name}
                    size="1"
                    variant="soft"
                    color="gray"
                    className="num"
                    onClick={() => updateConfig(node.id, { prompt: `${config.prompt}\${${name}}` })}
                  >
                    {name}
                  </Button>
                ))}
              </Flex>
            </Block>
          )}

          {config.kind === "router" && (
            <Block label="Routes">
              {config.routes.map((route: Route, index: number) => (
                <Flex key={index} align="center" gap="2">
                  <TextField.Root
                    style={{ width: 150, flexShrink: 0 }}
                    value={route.label}
                    onChange={(e) => {
                      const routes = [...config.routes];
                      routes[index] = { ...route, label: e.target.value };
                      updateConfig(node.id, { routes });
                    }}
                  />
                  <TextField.Root
                    style={{ flex: 1 }}
                    placeholder="When it applies"
                    value={route.description}
                    onChange={(e) => {
                      const routes = [...config.routes];
                      routes[index] = { ...route, description: e.target.value };
                      updateConfig(node.id, { routes });
                    }}
                  />
                  <Button
                    size="2"
                    variant="ghost"
                    color="gray"
                    aria-label="Remove this route"
                    onClick={() =>
                      updateConfig(node.id, {
                        routes: config.routes.filter((_, i) => i !== index),
                      })
                    }
                  >
                    <X size={15} />
                  </Button>
                </Flex>
              ))}
              <Button
                size="2"
                variant="soft"
                color="gray"
                style={{ alignSelf: "flex-start" }}
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
              <TextArea
                rows={2}
                value={config.description}
                onChange={(e) => updateConfig(node.id, { description: e.target.value })}
              />
            </Block>
          )}

          {nodeProblems.map((problem, index) => (
            <Text key={index} size="2" color={problem.severity === "error" ? "red" : "amber"}>
              {problem.message}
            </Text>
          ))}
        </Flex>

        <Flex align="center" mt="5">
          {!boundary && (
            <Button
              variant="ghost"
              color="red"
              onClick={() => {
                removeNode(node.id);
                setEditing(null);
              }}
            >
              Remove stage
            </Button>
          )}
          <Flex flexGrow="1" />
          <Button onClick={() => setEditing(null)}>Done</Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

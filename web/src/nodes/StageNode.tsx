import { Badge, Box, Flex, IconButton, Text } from "@radix-ui/themes";
import { Handle, Position } from "@xyflow/react";
import { Pencil, X } from "lucide-react";
import { memo } from "react";
import { BILLED, KIND_LABELS, KIND_TINT, usd } from "@/lib/kinds";
import type { Node, NodeEstimate, RunEvent } from "@/types/wire";

export type StageNodeData = {
  node: Node;
  estimate?: NodeEstimate;
  measured?: RunEvent;
  running: boolean;
  skipped: boolean;
  invalid: boolean;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
};

type StageNodeProps = { data: StageNodeData; selected?: boolean };

/** A stage reads top to bottom: what kind of work it is, what it is called,
 *  and what it is configured with. The kind is named and tinted rather than
 *  drawn as an icon, so two stages of the same kind are recognisable from
 *  across the canvas without anything to decode. */
function StageNodeImpl({ data, selected }: StageNodeProps) {
  const { node, estimate, measured, running, skipped, invalid, onRemove, onEdit } = data;
  const config = node.config;
  const kind = config.kind;
  const tint = KIND_TINT[kind];

  const border = invalid ? "var(--red-8)" : selected ? "var(--accent-9)" : "var(--gray-6)";

  if (kind === "input" || kind === "output") {
    return (
      <Box
        px="4"
        py="2"
        style={{
          borderRadius: 999,
          border: `1px dashed ${border}`,
          background: "var(--color-panel-solid)",
          opacity: skipped ? 0.4 : 1,
        }}
      >
        {kind === "output" && <Handle type="target" position={Position.Left} />}
        <Text size="2" color="gray">
          {node.name}
        </Text>
        {kind === "input" && <Handle type="source" position={Position.Right} />}
      </Box>
    );
  }

  const routes = kind === "router" ? config.routes : [];
  const settings: string[] = [];
  if ("model" in config) settings.push(config.model || "no model");
  if (kind === "react") settings.push(`${config.max_iterations} turns`);
  if (kind === "tool") settings.push(config.tool);
  if (kind === "subagent") settings.push(config.graph_id || "no agent chosen");

  return (
    <Box
      className={`orla-stage${running ? " stage-running" : ""}`}
      style={{
        width: 264,
        borderRadius: "var(--radius-4)",
        border: `1px solid ${border}`,
        background: "var(--color-panel-solid)",
        boxShadow: "var(--shadow-2)",
        opacity: skipped ? 0.4 : 1,
        overflow: "hidden",
      }}
    >
      <Box style={{ position: "absolute", inset: "0 auto 0 0", width: 3, background: tint }} />
      <Handle type="target" position={Position.Left} />

      <Box pl="4" pr="2" py="3">
        <Flex align="center" gap="2">
          <Text size="2" weight="medium" style={{ color: tint }}>
            {KIND_LABELS[kind]}
          </Text>
          <Flex flexGrow="1" />
          {BILLED[kind] && (
            <Text
              size="2"
              className="num"
              color={measured ? "green" : "gray"}
              title={measured ? "Measured on the last run" : "Estimated"}
            >
              {usd(measured ? (measured.usd ?? 0) : (estimate?.usd ?? 0))}
            </Text>
          )}
          <Flex className="orla-stage-actions" gap="1">
            <IconButton
              size="1"
              variant="ghost"
              color="gray"
              aria-label="Edit this stage"
              onClick={(event) => {
                event.stopPropagation();
                onEdit(node.id);
              }}
            >
              <Pencil size={15} />
            </IconButton>
            <IconButton
              size="1"
              variant="ghost"
              color="gray"
              aria-label="Remove this stage"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(node.id);
              }}
            >
              <X size={15} />
            </IconButton>
          </Flex>
        </Flex>

        <Text as="div" size="3" weight="bold" truncate mt="1">
          {node.name}
        </Text>

        <Flex gap="2" mt="2">
          {settings.map((setting) => (
            <Badge key={setting} color="gray" variant="soft" size="2">
              {setting}
            </Badge>
          ))}
        </Flex>
      </Box>

      {routes.length > 0 && (
        <Box style={{ borderTop: "1px solid var(--gray-6)" }}>
          {routes.map((route, index) => (
            <Box
              key={route.label}
              pr="4"
              py="2"
              style={{
                position: "relative",
                textAlign: "right",
                borderTop: index === 0 ? undefined : "1px solid var(--gray-6)",
              }}
            >
              <Text size="2" color="gray">
                {route.label}
              </Text>
              <Handle type="source" id={route.label} position={Position.Right} />
            </Box>
          ))}
        </Box>
      )}
      {routes.length === 0 && <Handle type="source" position={Position.Right} />}
    </Box>
  );
}

export const StageNode = memo(StageNodeImpl);

import { Button, Flex, Heading, IconButton, Table, Text } from "@radix-ui/themes";
import { Check, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ModelForm } from "@/panels/ModelForm";
import { useStore } from "@/store";
import type { ModelSpec } from "@/types/wire";

const ENDPOINT: Record<ModelSpec["provider"], string> = {
  "bedrock-mantle": "Bedrock mantle",
  "bedrock-runtime": "Bedrock Converse",
  anthropic: "Anthropic",
  openai: "OpenAI",
  ollama: "Ollama",
};

/** The model registry. Rates drive every estimate on every canvas. */
export function ModelsPage() {
  const models = useStore((s) => s.models);
  const setModels = useStore((s) => s.setModels);
  const [editing, setEditing] = useState<ModelSpec | "new" | null>(null);

  return (
    <>
      <Flex align="center" mb="6">
        <Heading size="8" style={{ flex: 1 }}>
          Models
        </Heading>
        <Button size="3" variant="outline" onClick={() => setEditing("new")}>
          <Plus size={18} />
          Add a model
        </Button>
      </Flex>

      <Table.Root size="3" variant="surface">
        <Table.Header>
          <Table.Row>
            <Table.ColumnHeaderCell>Model</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell>Endpoint</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">$ per M in</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="right">$ per M out</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="center">Tools</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell align="center">Typed answers</Table.ColumnHeaderCell>
            <Table.ColumnHeaderCell />
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {models.map((model) => (
            <Table.Row key={model.id} className="model-row" onClick={() => setEditing(model)}>
              <Table.RowHeaderCell>
                <Text weight="medium">{model.label || model.id}</Text>
                <Text as="p" size="2" color="gray" className="num">
                  {model.model}
                </Text>
              </Table.RowHeaderCell>
              <Table.Cell>{ENDPOINT[model.provider]}</Table.Cell>
              <Table.Cell align="right" className="num">
                {model.input_usd_per_mtok.toFixed(2)}
              </Table.Cell>
              <Table.Cell align="right" className="num">
                {model.output_usd_per_mtok.toFixed(2)}
              </Table.Cell>
              <Table.Cell align="center">{model.tools && <Check size={16} />}</Table.Cell>
              <Table.Cell align="center">{model.structured && <Check size={16} />}</Table.Cell>
              <Table.Cell align="right">
                <IconButton
                  size="1"
                  variant="ghost"
                  color="gray"
                  aria-label={`Remove ${model.label || model.id}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void setModels(models.filter((m) => m.id !== model.id));
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table.Root>

      {editing && (
        <ModelForm
          model={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (spec) => {
            await setModels(
              editing === "new"
                ? [...models, spec]
                : models.map((m) => (m.id === spec.id ? spec : m)),
            );
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

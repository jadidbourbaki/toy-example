import { Button, Dialog, Flex, IconButton, Select, Text, TextField } from "@radix-ui/themes";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/store";
import type { ModelSpec } from "@/types/wire";

const BLANK: ModelSpec = {
  id: "",
  provider: "bedrock-mantle",
  model: "",
  label: "",
  endpoint: "",
  api_key_var: "AWS_BEARER_TOKEN_BEDROCK",
  input_usd_per_mtok: 0,
  output_usd_per_mtok: 0,
  quality_prior: 0.5,
  tools: true,
  structured: true,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Flex align="center" gap="4">
      <Text size="2" color="gray" style={{ width: 200, flexShrink: 0 }}>
        {label}
      </Text>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </Flex>
  );
}

/** The registry, as a list you read rather than a grid you fill in. Editing one
 *  model opens that model, so a number is only ever typed beside the name it
 *  belongs to. */
export function ModelPicker() {
  const models = useStore((s) => s.models);
  const setModels = useStore((s) => s.setModels);
  const [editing, setEditing] = useState<ModelSpec | null>(null);
  const [adding, setAdding] = useState(false);

  const close = () => {
    setEditing(null);
    setAdding(false);
  };

  const commit = async (spec: ModelSpec) => {
    await setModels(adding ? [...models, spec] : models.map((m) => (m.id === spec.id ? spec : m)));
    close();
  };

  return (
    <Dialog.Root onOpenChange={(open) => !open && close()}>
      <Dialog.Trigger>
        <Button size="2" variant="outline">
          Models
        </Button>
      </Dialog.Trigger>
      <Dialog.Content maxWidth="600px">
        <Flex align="center" gap="3">
          <Dialog.Title size="4" mb="0" style={{ flex: 1 }}>
            {editing ? (adding ? "Add a model" : editing.label || editing.id) : "Models"}
          </Dialog.Title>
          {!editing && (
            <Button
              size="2"
              variant="outline"
              onClick={() => {
                setEditing({ ...BLANK });
                setAdding(true);
              }}
            >
              <Plus size={16} />
              Add a model
            </Button>
          )}
        </Flex>

        {editing ? (
          <>
            <Flex direction="column" gap="4" mt="5">
              {(
                [
                  ["Name", "label", "Qwen3 Coder 30B"],
                  ["Short name", "id", "qwen3-coder-30b"],
                  ["Provider id", "model", "qwen.qwen3-coder-30b-a3b-instruct"],
                ] as const
              ).map(([label, field, hint]) => (
                <Field key={field} label={label}>
                  <TextField.Root
                    placeholder={hint}
                    value={editing[field]}
                    disabled={field === "id" && !adding}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                  />
                </Field>
              ))}

              <Field label="Endpoint">
                <Select.Root
                  value={editing.provider}
                  onValueChange={(value) =>
                    setEditing({ ...editing, provider: value as ModelSpec["provider"] })
                  }
                >
                  <Select.Trigger style={{ width: "100%" }} />
                  <Select.Content>
                    <Select.Item value="bedrock-mantle">Bedrock mantle</Select.Item>
                    <Select.Item value="bedrock-runtime">Bedrock Converse</Select.Item>
                  </Select.Content>
                </Select.Root>
              </Field>

              {(
                [
                  ["Price per million input tokens", "input_usd_per_mtok"],
                  ["Price per million output tokens", "output_usd_per_mtok"],
                ] as const
              ).map(([label, field]) => (
                <Field key={field} label={label}>
                  <TextField.Root
                    type="number"
                    step="0.01"
                    className="num"
                    style={{ width: 140 }}
                    value={String(editing[field])}
                    onChange={(e) => setEditing({ ...editing, [field]: Number(e.target.value) })}
                  />
                </Field>
              ))}

              <Field label="Quality out of 1">
                <TextField.Root
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  className="num"
                  style={{ width: 140 }}
                  value={String(editing.quality_prior)}
                  onChange={(e) =>
                    setEditing({ ...editing, quality_prior: Number(e.target.value) })
                  }
                />
              </Field>
            </Flex>

            <Flex justify="end" gap="3" mt="5">
              <Button variant="soft" color="gray" onClick={close}>
                Cancel
              </Button>
              <Button disabled={!editing.id || !editing.model} onClick={() => void commit(editing)}>
                Save
              </Button>
            </Flex>
          </>
        ) : (
          <Flex direction="column" mt="4" style={{ maxHeight: "56vh", overflowY: "auto" }}>
            {models.map((model) => (
              <Flex key={model.id} align="center" gap="3" py="2">
                <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
                  <Text truncate>{model.label || model.id}</Text>
                  <Text size="2" color="gray" className="num" truncate>
                    {model.model}
                  </Text>
                </Flex>
                <Button
                  size="2"
                  variant="outline"
                  onClick={() => {
                    setEditing({ ...model });
                    setAdding(false);
                  }}
                >
                  <Pencil size={15} />
                  Edit
                </Button>
                <IconButton
                  size="2"
                  variant="ghost"
                  color="gray"
                  aria-label={`Remove ${model.label || model.id}`}
                  onClick={() => void setModels(models.filter((m) => m.id !== model.id))}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Flex>
            ))}
          </Flex>
        )}
      </Dialog.Content>
    </Dialog.Root>
  );
}

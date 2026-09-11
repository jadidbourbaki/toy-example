import { Button, Checkbox, Dialog, Flex, Select, Text, TextField } from "@radix-ui/themes";
import { useState } from "react";
import type { ModelSpec } from "@/types/wire";

export type ModelFormProps = {
  model: ModelSpec | null;
  onClose: () => void;
  onSave: (spec: ModelSpec) => Promise<void>;
};

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

/** One model, edited on its own so a number is only ever typed beside the
 *  name it belongs to. */
export function ModelForm({ model, onClose, onSave }: ModelFormProps) {
  const adding = model === null;
  const [spec, setSpec] = useState<ModelSpec>(model ?? BLANK);
  const change = (patch: Partial<ModelSpec>) => setSpec({ ...spec, ...patch });

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Content maxWidth="560px">
        <Dialog.Title size="5">{adding ? "Add a model" : spec.label || spec.id}</Dialog.Title>
        <Flex direction="column" gap="4" mt="5">
          <Field label="Name">
            <TextField.Root
              value={spec.label}
              onChange={(e) => change({ label: e.target.value })}
            />
          </Field>
          <Field label="Short name">
            <TextField.Root
              value={spec.id}
              disabled={!adding}
              onChange={(e) => change({ id: e.target.value })}
            />
          </Field>
          <Field label="Provider id">
            <TextField.Root
              className="num"
              value={spec.model}
              onChange={(e) => change({ model: e.target.value })}
            />
          </Field>
          <Field label="Endpoint">
            <Select.Root
              value={spec.provider}
              onValueChange={(value) => change({ provider: value as ModelSpec["provider"] })}
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
              ["Price per million input tokens", "input_usd_per_mtok", "0.01"],
              ["Price per million output tokens", "output_usd_per_mtok", "0.01"],
              ["Quality out of 1", "quality_prior", "0.05"],
            ] as const
          ).map(([label, field, step]) => (
            <Field key={field} label={label}>
              <TextField.Root
                type="number"
                step={step}
                className="num"
                style={{ width: 140 }}
                value={String(spec[field])}
                onChange={(e) => change({ [field]: Number(e.target.value) })}
              />
            </Field>
          ))}
          <Field label="Can call tools">
            <Checkbox
              checked={spec.tools}
              onCheckedChange={(on) => change({ tools: on === true })}
            />
          </Field>
          <Field label="Can return typed answers">
            <Checkbox
              checked={spec.structured}
              onCheckedChange={(on) => change({ structured: on === true })}
            />
          </Field>
        </Flex>
        <Flex justify="end" gap="3" mt="5">
          <Button variant="soft" color="gray" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!spec.id || !spec.model} onClick={() => void onSave(spec)}>
            Save
          </Button>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}

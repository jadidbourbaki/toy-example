import * as Dialog from "@radix-ui/react-dialog";
import { ChevronRight, Plus, Trash2, X } from "lucide-react";
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

/** The registry, as a list you read rather than a grid you fill in. Editing one
 *  model opens that model, so the numbers are only ever entered next to the
 *  name they belong to. */
export function ModelPicker() {
  const models = useStore((s) => s.models);
  const setModels = useStore((s) => s.setModels);
  const [editing, setEditing] = useState<ModelSpec | null>(null);
  const [adding, setAdding] = useState(false);

  const commit = async (spec: ModelSpec) => {
    await setModels(adding ? [...models, spec] : models.map((m) => (m.id === spec.id ? spec : m)));
    setEditing(null);
    setAdding(false);
  };

  const remove = async (id: string) => {
    await setModels(models.filter((m) => m.id !== id));
  };

  return (
    <Dialog.Root
      onOpenChange={(open) => {
        if (!open) {
          setEditing(null);
          setAdding(false);
        }
      }}
    >
      <Dialog.Trigger asChild>
        <button className="btn">Models</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/25" />
        <Dialog.Content className="fixed top-1/2 left-1/2 flex max-h-[78vh] w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl">
          <div className="flex items-center gap-3 border-b border-line px-5 py-4">
            <Dialog.Title className="flex-1 text-[17px] font-medium">
              {editing ? (adding ? "Add a model" : editing.label || editing.id) : "Models"}
            </Dialog.Title>
            {!editing && (
              <button
                className="btn py-1.5"
                onClick={() => {
                  setEditing({ ...BLANK });
                  setAdding(true);
                }}
              >
                <Plus size={15} />
                Add
              </button>
            )}
            <Dialog.Close asChild>
              <button className="btn-quiet" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          {editing ? (
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {(
                [
                  ["Name", "label", "text", "Qwen3 Coder 30B"],
                  ["Registry id", "id", "text", "qwen3-coder-30b"],
                  ["Model id", "model", "text", "qwen.qwen3-coder-30b-a3b-instruct"],
                ] as const
              ).map(([label, field, , hint]) => (
                <label key={field} className="mb-3 flex items-center gap-3">
                  <span className="w-28 shrink-0 text-[13px] text-mute">{label}</span>
                  <input
                    className="field py-1.5"
                    placeholder={hint}
                    value={editing[field]}
                    disabled={field === "id" && !adding}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                  />
                </label>
              ))}

              <label className="mb-3 flex items-center gap-3">
                <span className="w-28 shrink-0 text-[13px] text-mute">Endpoint</span>
                <select
                  className="field py-1.5"
                  value={editing.provider}
                  onChange={(e) =>
                    setEditing({ ...editing, provider: e.target.value as ModelSpec["provider"] })
                  }
                >
                  <option value="bedrock-mantle">Bedrock mantle</option>
                  <option value="bedrock-runtime">Bedrock Converse</option>
                </select>
              </label>

              <div className="mb-3 flex items-center gap-3">
                <span className="w-28 shrink-0 text-[13px] text-mute">Per million</span>
                {(["input_usd_per_mtok", "output_usd_per_mtok"] as const).map((field) => (
                  <label key={field} className="flex flex-1 items-center gap-2">
                    <span className="text-[13px] text-faint">
                      {field.startsWith("input") ? "in" : "out"}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      className="field num py-1.5"
                      value={editing[field]}
                      onChange={(e) => setEditing({ ...editing, [field]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>

              <label className="mb-3 flex items-center gap-3">
                <span className="w-28 shrink-0 text-[13px] text-mute">Quality</span>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={1}
                  className="field num w-24 py-1.5"
                  value={editing.quality_prior}
                  onChange={(e) =>
                    setEditing({ ...editing, quality_prior: Number(e.target.value) })
                  }
                />
                <span className="text-[13px] text-faint">
                  Your own belief, from 0 to 1. The optimizer trades it against cost.
                </span>
              </label>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  className="btn"
                  onClick={() => {
                    setEditing(null);
                    setAdding(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!editing.id || !editing.model}
                  onClick={() => void commit(editing)}
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-1">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="group flex items-center gap-3 px-5 py-2.5 hover:bg-sunk"
                >
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setEditing({ ...model });
                      setAdding(false);
                    }}
                  >
                    <div className="truncate">{model.label || model.id}</div>
                    <div className="num truncate text-[12px] text-faint">{model.model}</div>
                  </button>
                  <button
                    className="shrink-0 text-faint opacity-0 group-hover:opacity-100 hover:text-bad"
                    onClick={() => void remove(model.id)}
                    title={`Remove ${model.label || model.id}`}
                  >
                    <Trash2 size={15} />
                  </button>
                  <ChevronRight size={15} className="shrink-0 text-faint" />
                </div>
              ))}
              <p className="px-5 py-3 text-[13px] text-faint">
                Rates are dollars per million tokens and drive what the canvas says a request costs.
                Nothing here is fetched, so edit a rate that has moved.
              </p>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

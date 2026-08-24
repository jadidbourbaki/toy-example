import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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

  const close = () => {
    setEditing(null);
    setAdding(false);
  };

  return (
    <Dialog onOpenChange={(open) => !open && close()}>
      <DialogTrigger asChild>
        <Button variant="outline">Models</Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[78vh] flex-col gap-0 p-0 sm:max-w-[600px]">
        <DialogHeader className="flex-row items-center gap-3 border-b px-6 py-4">
          <DialogTitle className="flex-1 text-lg">
            {editing ? (adding ? "Add a model" : editing.label || editing.id) : "Models"}
          </DialogTitle>
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditing({ ...BLANK });
                setAdding(true);
              }}
            >
              <Plus />
              Add a model
            </Button>
          )}
        </DialogHeader>

        {editing ? (
          <>
            <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
              {(
                [
                  ["Name", "label", "Qwen3 Coder 30B"],
                  ["Short name", "id", "qwen3-coder-30b"],
                  ["Provider id", "model", "qwen.qwen3-coder-30b-a3b-instruct"],
                ] as const
              ).map(([label, field, hint]) => (
                <div key={field} className="grid grid-cols-[8rem_1fr] items-center gap-4">
                  <Label className="text-muted-foregroundd-foreground">{label}</Label>
                  <Input
                    placeholder={hint}
                    value={editing[field]}
                    disabled={field === "id" && !adding}
                    onChange={(e) => setEditing({ ...editing, [field]: e.target.value })}
                  />
                </div>
              ))}

              <div className="grid grid-cols-[8rem_1fr] items-center gap-4">
                <Label className="text-muted-foregroundd-foreground">Endpoint</Label>
                <Select
                  value={editing.provider}
                  onValueChange={(value) =>
                    setEditing({ ...editing, provider: value as ModelSpec["provider"] })
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bedrock-mantle">Bedrock mantle</SelectItem>
                    <SelectItem value="bedrock-runtime">Bedrock Converse</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(
                [
                  ["Price per million input tokens", "input_usd_per_mtok"],
                  ["Price per million output tokens", "output_usd_per_mtok"],
                ] as const
              ).map(([label, field]) => (
                <div key={field} className="grid grid-cols-[8rem_1fr] items-center gap-4">
                  <Label className="text-muted-foregroundd-foreground">{label}</Label>
                  <Input
                    type="number"
                    step="0.01"
                    className="num w-32"
                    value={editing[field]}
                    onChange={(e) => setEditing({ ...editing, [field]: Number(e.target.value) })}
                  />
                </div>
              ))}

              <div className="grid grid-cols-[8rem_1fr] items-center gap-4">
                <Label className="text-muted-foregroundd-foreground">Quality out of 1</Label>
                <Input
                  type="number"
                  step="0.05"
                  min={0}
                  max={1}
                  className="num w-32"
                  value={editing.quality_prior}
                  onChange={(e) =>
                    setEditing({ ...editing, quality_prior: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <DialogFooter className="border-t px-6 py-4">
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button disabled={!editing.id || !editing.model} onClick={() => void commit(editing)}>
                Save
              </Button>
            </DialogFooter>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto py-2">
            {models.map((model) => (
              <div key={model.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{model.label || model.id}</div>
                  <div className="num truncate text-muted-foregroundd-foreground">
                    {model.model}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing({ ...model });
                    setAdding(false);
                  }}
                >
                  <Pencil />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${model.label || model.id}`}
                  onClick={() => void setModels(models.filter((m) => m.id !== model.id))}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

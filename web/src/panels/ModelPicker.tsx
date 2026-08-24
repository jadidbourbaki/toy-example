import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/store";
import type { ModelSpec } from "@/types/wire";

/** The registry every stage binds to. The rates here drive what the canvas
 *  says a request costs, so they are editable. */
export function ModelPicker() {
  const models = useStore((s) => s.models);
  const setModels = useStore((s) => s.setModels);
  const [draft, setDraft] = useState<ModelSpec[] | null>(null);
  const rows = draft ?? models;

  const edit = (index: number, change: Partial<ModelSpec>) =>
    setDraft(rows.map((row, i) => (i === index ? { ...row, ...change } : row)));

  return (
    <Dialog.Root onOpenChange={(open) => !open && setDraft(null)}>
      <Dialog.Trigger asChild>
        <button className="btn">Models</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/20" />
        <Dialog.Content className="fixed top-1/2 left-1/2 max-h-[80vh] w-[720px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-raised shadow-2xl">
          <div className="flex items-baseline gap-3 border-b border-line px-6 py-4">
            <Dialog.Title className="text-[17px] font-medium">Models</Dialog.Title>
            <Dialog.Description className="flex-1 text-[13px] text-faint">
              Dollars per million tokens
            </Dialog.Description>
            <Dialog.Close asChild>
              <button className="btn-quiet" aria-label="Close">
                <X size={16} />
              </button>
            </Dialog.Close>
          </div>

          <div className="px-6 py-2">
            {rows.map((model, index) => (
              <div
                key={model.id}
                className="flex items-center gap-4 border-b border-line py-3 last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate">{model.label}</div>
                  <div className="num truncate text-[12px] text-faint">{model.model}</div>
                </div>

                {!model.tools && (
                  <span className="shrink-0 rounded-md bg-sunk px-2 py-0.5 text-[12px] text-mute">
                    no tools
                  </span>
                )}

                {(["input_usd_per_mtok", "output_usd_per_mtok"] as const).map((field) => (
                  <label key={field} className="shrink-0">
                    <span className="mb-0.5 block text-[12px] text-faint">
                      {field === "input_usd_per_mtok" ? "in" : "out"}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      className="field num w-24 py-1"
                      value={model[field]}
                      onChange={(e) => edit(index, { [field]: Number(e.target.value) })}
                    />
                  </label>
                ))}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Dialog.Close asChild>
              <button className="btn">Cancel</button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                className="btn btn-primary"
                onClick={() => draft && void setModels(draft)}
                disabled={!draft}
              >
                Save
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import * as Dialog from "@radix-ui/react-dialog";
import { Cpu } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/store";
import type { ModelSpec } from "@/types/wire";

/** The registry every stage binds to. Rates here drive the cost estimate, so
 *  editing one changes what the whole canvas says a request costs. */
export function ModelPicker() {
  const models = useStore((s) => s.models);
  const setModels = useStore((s) => s.setModels);
  const [draft, setDraft] = useState<ModelSpec[] | null>(null);
  const rows = draft ?? models;

  const edit = (index: number, change: Partial<ModelSpec>) => {
    const next = rows.map((row, i) => (i === index ? { ...row, ...change } : row));
    setDraft(next);
  };

  return (
    <Dialog.Root onOpenChange={(open) => !open && setDraft(null)}>
      <Dialog.Trigger asChild>
        <button className="btn" title="Models available to every stage">
          <Cpu size={12} /> Models
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 max-h-[80vh] w-[760px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded border border-line bg-slate p-4 shadow-2xl">
          <Dialog.Title className="text-[14px] text-chalk">Model registry</Dialog.Title>
          <Dialog.Description className="mt-1 mb-4 text-[12px] leading-relaxed text-mute">
            A stage names a model by its id here, so retargeting a stage is a one word change. The
            rates drive the cost estimate on the canvas.
          </Dialog.Description>

          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left">
                {["id", "provider", "model", "$/Mtok in", "$/Mtok out", "quality"].map((head) => (
                  <th key={head} className="eyebrow pb-1.5 font-medium">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((model, index) => (
                <tr key={model.id} className="border-t border-line-soft">
                  <td className="ident py-1.5 pr-2 text-chalk">{model.id}</td>
                  <td className="ident py-1.5 pr-2 text-mute">{model.provider}</td>
                  <td className="ident py-1.5 pr-2 text-mute">{model.model}</td>
                  {(["input_usd_per_mtok", "output_usd_per_mtok", "quality_prior"] as const).map(
                    (field) => (
                      <td key={field} className="py-1 pr-2">
                        <input
                          type="number"
                          step="0.01"
                          className="field num w-20 py-1"
                          value={model[field]}
                          onChange={(e) => edit(index, { [field]: Number(e.target.value) })}
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button className="btn">Cancel</button>
            </Dialog.Close>
            <Dialog.Close asChild>
              <button
                className="btn btn-primary"
                onClick={() => draft && void setModels(draft)}
                disabled={!draft}
              >
                Save rates
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { useStore } from "@/store";

export type AgentModalProps = { open: boolean; onClose: () => void };

/** The agent's own settings: what it is called and what it is for. */
export function AgentModal({ open, onClose }: AgentModalProps) {
  const graph = useStore((s) => s.graph);
  const patchGraph = useStore((s) => s.patchGraph);
  const removeGraph = useStore((s) => s.removeGraph);
  if (!graph) return null;

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/25" />
        <Dialog.Content className="fixed top-1/2 left-1/2 w-[480px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <div className="flex items-center gap-3 border-b border-border px-6 py-4">
            <Dialog.Title className="flex-1 text-[17px] font-medium">Agent settings</Dialog.Title>
            <Dialog.Close asChild>
              <button
                className="rounded-lg px-2 py-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex flex-col gap-4 px-6 py-5">
            <label className="flex items-center gap-4">
              <span className="w-24 shrink-0 text-[14px] text-muted-foreground">Name</span>
              <input
                className="w-full rounded-lg border bg-card px-3 py-2"
                value={graph.name}
                onChange={(e) => patchGraph({ name: e.target.value })}
              />
            </label>
            <div>
              <div className="mb-1.5 text-[14px] text-muted-foreground">Description</div>
              <textarea
                className="w-full rounded-lg border bg-card px-3 py-2 h-20 resize-none"
                value={graph.description}
                onChange={(e) => patchGraph({ description: e.target.value })}
              />
            </div>
          </div>

          <div className="flex items-center border-t border-border px-6 py-3.5">
            <button
              className="text-[14px] text-muted-foreground hover:text-destructive"
              onClick={() => {
                onClose();
                void removeGraph(graph.id);
              }}
            >
              Delete agent
            </button>
            <div className="flex-1" />
            <Dialog.Close asChild>
              <button className="inline-flex items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-40">
                Done
              </button>
            </Dialog.Close>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

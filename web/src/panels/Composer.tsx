import { Button, TextArea } from "@radix-ui/themes";
import { Panel } from "@xyflow/react";
import { Square } from "lucide-react";
import { useRun } from "@/lib/useRun";
import { RunOutput } from "@/panels/RunOutput";

/** Where a request goes in, floating at the foot of the canvas. What comes
 *  back rises above it. Enter sends, and Shift+Enter starts a new line. */
export function Composer() {
  const run = useRun();

  return (
    <Panel position="bottom-center" className="composer-panel">
      <RunOutput
        error={run.error}
        approval={run.approval}
        answer={run.answer}
        onDecide={(decision) => void run.decide(decision)}
        onDismiss={run.dismiss}
      />
      <div className="composer">
        <TextArea
          size="3"
          rows={1}
          value={run.prompt}
          onChange={(e) => run.setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!run.busy) void run.start();
            }
          }}
        />
        {run.busy ? (
          <Button size="3" variant="outline" onClick={run.stop}>
            <Square size={15} /> Stop
          </Button>
        ) : (
          <Button size="3" onClick={() => void run.start()}>
            Run
          </Button>
        )}
      </div>
    </Panel>
  );
}

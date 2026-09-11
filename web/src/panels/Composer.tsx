import { Button, Text, TextField } from "@radix-ui/themes";
import { Panel } from "@xyflow/react";
import { Square } from "lucide-react";
import { usd } from "@/lib/kinds";
import { useRun } from "@/lib/useRun";
import { RunOutput } from "@/panels/RunOutput";
import { useStore } from "@/store";

/** Where a request goes in, floating at the foot of the canvas. What comes
 *  back rises above it. */
export function Composer() {
  const estimate = useStore((s) => s.estimate);
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
        <TextField.Root
          size="3"
          variant="soft"
          color="gray"
          style={{ flex: 1 }}
          value={run.prompt}
          onChange={(e) => run.setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !run.busy) void run.start();
          }}
        />
        {estimate && (
          <Text size="2" color="gray" className="num">
            {usd(estimate.usd)}
          </Text>
        )}
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

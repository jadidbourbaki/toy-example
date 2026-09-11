import { Button, Flex, TextArea } from "@radix-ui/themes";
import { Panel } from "@xyflow/react";
import { Square } from "lucide-react";
import { useRun } from "@/lib/useRun";
import { RunOutput } from "@/panels/RunOutput";

/** Where a request goes in, floating at the foot of the canvas. What comes
 *  back rises above it. Run takes the whole workflow at once. Step pauses
 *  before each stage and moves on one stage per click. */
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
              if (!run.busy) void run.start(false);
            }
          }}
        />
        <Flex justify="end" gap="2">
          {run.busy ? (
            <>
              <Button size="2" variant="outline" color="gray" onClick={run.stop}>
                <Square size={14} /> Stop
              </Button>
              {run.stepping && (
                <Button size="2" onClick={() => void run.next()} disabled={!run.canStep}>
                  Step
                </Button>
              )}
            </>
          ) : (
            <>
              <Button size="2" variant="outline" onClick={() => void run.start(true)}>
                Step
              </Button>
              <Button size="2" onClick={() => void run.start(false)}>
                Run
              </Button>
            </>
          )}
        </Flex>
      </div>
    </Panel>
  );
}

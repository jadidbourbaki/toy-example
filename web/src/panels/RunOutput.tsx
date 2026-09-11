import { Box, Button, Callout, Flex, Text, TextField } from "@radix-ui/themes";
import { X } from "lucide-react";
import { useState } from "react";
import { ms, usd } from "@/lib/kinds";
import type { Approval } from "@/lib/useRun";
import type { Decision, RunEvent } from "@/types/wire";

export type RunOutputProps = {
  error: string;
  approval: Approval | null;
  answer: RunEvent | null;
  onDecide: (decision: Decision) => void;
  onDismiss: () => void;
};

/** What a run has to say while it runs and once it is done: an error, a
 *  stage waiting on a person, or the answer. */
export function RunOutput({ error, approval, answer, onDecide, onDismiss }: RunOutputProps) {
  const [note, setNote] = useState("");

  const sendBack = () => {
    onDecide({ approved: false, note });
    setNote("");
  };

  return (
    <>
      {error && (
        <Box px="4" pb="3">
          <Callout.Root color="red" size="1" className="run-card">
            <Callout.Text>{error}</Callout.Text>
          </Callout.Root>
        </Box>
      )}

      {approval && (
        <Box px="4" pb="3">
          <Callout.Root color="crimson" size="2" variant="surface" className="run-card">
            <Flex direction="column" gap="3" style={{ flex: 1 }}>
              <Text size="3" weight="bold">
                {approval.question}
              </Text>
              <Text size="3" style={{ whiteSpace: "pre-wrap" }}>
                {approval.text}
              </Text>
              <Flex gap="3" align="center">
                <TextField.Root
                  size="2"
                  style={{ flex: 1 }}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button size="2" variant="outline" color="gray" onClick={sendBack}>
                  {note.trim() ? "Send back" : "Stop"}
                </Button>
                <Button size="2" onClick={() => onDecide({ approved: true, note: "" })}>
                  Approve
                </Button>
              </Flex>
            </Flex>
          </Callout.Root>
        </Box>
      )}

      {answer && (
        <Box px="4" pb="3">
          <Callout.Root color="gray" size="2" variant="surface" className="run-card">
            <Flex direction="column" gap="2" style={{ flex: 1 }}>
              <Text size="3" style={{ whiteSpace: "pre-wrap" }}>
                {answer.text}
              </Text>
              <Flex gap="4" align="center">
                <Text size="2" color="gray" className="num">
                  {ms(answer.ms)}
                </Text>
                <Text size="2" color="gray" className="num">
                  {usd(answer.usd)}
                </Text>
                <Flex flexGrow="1" />
                <Button size="1" variant="ghost" color="gray" onClick={onDismiss}>
                  <X size={14} />
                </Button>
              </Flex>
            </Flex>
          </Callout.Root>
        </Box>
      )}
    </>
  );
}

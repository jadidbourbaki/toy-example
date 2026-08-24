import { Box, Button, Code, Flex, ScrollArea, Text } from "@radix-ui/themes";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { streamCompile } from "@/lib/api";
import { useStore } from "@/store";

const STEP_TEXT: Record<string, string> = {
  writing: "Writing the module",
  checking: "Checking it",
  rejected: "Fixing what the check found",
};

/** How long the compile has been running. A model takes long enough that a
 *  still screen reads as a hang. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(since);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(timer);
  }, []);
  return (
    <Text size="2" color="gray" className="num">
      {Math.max(0, (now - since) / 1000).toFixed(1)}s
    </Text>
  );
}

export function CodePanel() {
  const graph = useStore((s) => s.graph);
  const compile = useStore((s) => s.compile);
  const setCompile = useStore((s) => s.setCompile);
  const [copied, setCopied] = useState(false);

  const start = async () => {
    if (!graph) return;
    setCompile({
      running: true,
      attempt: 0,
      step: "writing",
      result: null,
      problems: [],
      error: "",
      startedAt: Date.now(),
    });
    try {
      await streamCompile(graph, (event) => {
        if (event.type === "error") setCompile({ error: event.text });
        else if (event.type === "done")
          setCompile({ result: event.result, problems: event.problems });
        else setCompile({ step: event.type, attempt: event.attempt, problems: event.problems });
      });
    } catch (err) {
      setCompile({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      setCompile({ running: false, step: "" });
    }
  };

  const copy = async () => {
    if (!compile.result?.source) return;
    await navigator.clipboard.writeText(compile.result.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const { result, running, step, attempt, error } = compile;

  return (
    <Flex direction="column" flexGrow="1" style={{ minHeight: 0 }}>
      <Flex
        align="center"
        gap="4"
        px="4"
        py="3"
        style={{ borderBottom: "1px solid var(--gray-6)" }}
      >
        <Button size="2" onClick={() => void start()} disabled={running || !graph}>
          {running ? "Compiling" : "Compile"}
        </Button>

        {running && (
          <>
            <Text size="2" color="gray">
              {STEP_TEXT[step] ?? "Working"}
              {attempt > 1 ? ` (attempt ${attempt})` : ""}
            </Text>
            <Elapsed since={compile.startedAt} />
          </>
        )}

        {result?.source && !running && (
          <Button size="2" variant="outline" onClick={() => void copy()}>
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Copied" : "Copy"}
          </Button>
        )}

        <Flex flexGrow="1" />

        {result && !running && (
          <Text size="2" color="gray" className="num">
            {result.source.split("\n").length} lines
          </Text>
        )}
      </Flex>

      {compile.problems.length > 0 && running && (
        <Flex direction="column" px="4" py="2" style={{ background: "var(--amber-2)" }}>
          {compile.problems.map((problem, index) => (
            <Text key={index} size="2" color="amber" className="num">
              {problem}
            </Text>
          ))}
        </Flex>
      )}

      {(error || (result && !result.ok)) && (
        <Flex direction="column" px="4" py="2" style={{ background: "var(--red-2)" }}>
          {error && (
            <Text size="2" color="red">
              {error}
            </Text>
          )}
          {result?.problems.map((problem, index) => (
            <Text key={index} size="2" color="red" className="num">
              {problem}
            </Text>
          ))}
        </Flex>
      )}

      {result?.notes && !running && (
        <Box px="4" py="2" style={{ borderBottom: "1px solid var(--gray-6)" }}>
          <Text size="2" color="gray">
            {result.notes}
          </Text>
        </Box>
      )}

      <ScrollArea style={{ flex: 1 }}>
        {result?.source ? (
          <Code
            variant="ghost"
            size="2"
            style={{ display: "block", whiteSpace: "pre", padding: "var(--space-4)" }}
          >
            {result.source}
          </Code>
        ) : (
          !running && (
            <Box p="4">
              <Text size="2" color="gray">
                Compile this agent into a runnable module.
              </Text>
            </Box>
          )
        )}
      </ScrollArea>
    </Flex>
  );
}

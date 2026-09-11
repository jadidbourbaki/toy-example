import { Button, Flex, ScrollArea, Text } from "@radix-ui/themes";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { SourceView } from "@/panels/SourceView";
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
  const compile = useStore((s) => s.compile);
  const runCompile = useStore((s) => s.runCompile);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!compile.result?.source) return;
    await navigator.clipboard.writeText(compile.result.source);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const { result, running, step, attempt, error } = compile;

  return (
    <Flex direction="column" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      {!running && !result && !error && (
        <Flex align="center" justify="center" style={{ flex: 1 }}>
          <Button size="3" onClick={() => void runCompile()}>
            Compile
          </Button>
        </Flex>
      )}

      {running && (
        <Flex align="center" gap="3" px="4" py="2">
          <Text size="2" color="gray">
            {STEP_TEXT[step] ?? "Working"}
            {attempt > 1 ? ` (attempt ${attempt})` : ""}
          </Text>
          <Elapsed since={compile.startedAt} />
        </Flex>
      )}

      {(result || error) && !running && (
        <Flex px="4" py="2" gap="2" justify="end">
          {result?.source && (
            <Button size="1" variant="ghost" color="gray" onClick={() => void copy()}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
          <Button size="1" variant="outline" onClick={() => void runCompile()}>
            Compile again
          </Button>
        </Flex>
      )}

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

      <ScrollArea scrollbars="both" style={{ flex: 1, minWidth: 0 }}>
        {result?.source && <SourceView source={result.source} />}
      </ScrollArea>
    </Flex>
  );
}

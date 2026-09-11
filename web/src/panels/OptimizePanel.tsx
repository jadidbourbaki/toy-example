import { Badge, Box, Button, Card, Checkbox, Flex, ScrollArea, Text } from "@radix-ui/themes";
import { FlaskConical, Square } from "lucide-react";
import { useRef, useState } from "react";
import { api, streamMeasure } from "@/lib/api";
import { ms, signedUsd, usd } from "@/lib/kinds";
import { SampleEditor } from "@/panels/SampleEditor";
import { useStore } from "@/store";
import type { MeasurePlan, Patch, PatchMeasurement } from "@/types/wire";

function Measured({ measured }: { measured: PatchMeasurement }) {
  const worse = measured.losses > measured.wins;
  const verdict = worse ? "worse" : measured.wins > measured.losses ? "better" : "no difference";

  return (
    <Card mt="3" variant="surface">
      <Flex align="center" gap="4" wrap="wrap">
        <Text size="2" color="gray">
          Measured
        </Text>
        <Text size="2" className="num" color={measured.usd_delta < 0 ? "green" : "amber"}>
          {signedUsd(measured.usd_delta)} per request
        </Text>
        <Text size="2" className="num" color="gray">
          {measured.ms_delta >= 0 ? "+" : "−"}
          {ms(Math.abs(measured.ms_delta))}
        </Text>
        <Badge color={worse ? "red" : measured.wins > measured.losses ? "green" : "gray"} size="2">
          {verdict}
        </Badge>
        <Flex flexGrow="1" />
        <Text size="2" color="gray" className="num">
          n={measured.paired}
        </Text>
      </Flex>

      {measured.error && (
        <Text as="p" size="2" color="red" mt="2">
          {measured.error}
        </Text>
      )}

      {measured.verdicts.map((verdictRow, index) => (
        <Flex key={index} gap="3" mt="2" align="start">
          <Text
            size="2"
            style={{ width: 64, flexShrink: 0 }}
            color={
              verdictRow.winner === "candidate"
                ? "green"
                : verdictRow.winner === "baseline"
                  ? "red"
                  : "gray"
            }
          >
            {verdictRow.winner === "candidate"
              ? "better"
              : verdictRow.winner === "baseline"
                ? "worse"
                : "tie"}
          </Text>
          <Text size="2" color="gray">
            {verdictRow.reason}
          </Text>
        </Flex>
      ))}
    </Card>
  );
}

export function OptimizePanel() {
  const graph = useStore((s) => s.graph);
  const setGraph = useStore((s) => s.setGraph);
  const setEditing = useStore((s) => s.setEditing);
  const { result, busy, error: askError } = useStore((s) => s.optimize);
  const findImprovements = useStore((s) => s.findImprovements);
  const clearImprovements = useStore((s) => s.clearImprovements);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [measured, setMeasured] = useState<Record<string, PatchMeasurement>>({});
  const [plan, setPlan] = useState<MeasurePlan | null>(null);
  const [baselineUsd, setBaselineUsd] = useState<number | null>(null);
  const [measuring, setMeasuring] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);

  const chosen: Patch[] =
    result?.patches.filter((p) => p.patch.id && accepted.has(p.patch.id)).map((p) => p.patch) ?? [];

  const toggle = async (id: string) => {
    const next = new Set(accepted);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAccepted(next);
    if (!graph) return;
    const patches =
      result?.patches.filter((p) => p.patch.id && next.has(p.patch.id)).map((p) => p.patch) ?? [];
    setPlan(patches.length ? await api.measurePlan(graph, patches, graph.sample) : null);
  };

  const measure = async () => {
    if (!graph || chosen.length === 0) return;
    setMeasuring(true);
    setError("");
    abort.current = new AbortController();
    try {
      await streamMeasure(
        graph,
        chosen,
        graph.sample,
        (event) => {
          if (event.type === "plan" && event.plan) setPlan(event.plan);
          if (event.type === "baseline_done" && event.baseline) setBaselineUsd(event.baseline.usd);
          if (event.type === "patch_done" && event.patch) {
            const done = event.patch;
            setMeasured((prior) => ({ ...prior, [done.patch_id]: done }));
          }
          if (event.type === "error") setError(event.text);
        },
        abort.current.signal,
      );
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setMeasuring(false);
    }
  };

  const applyChosen = async () => {
    if (!graph || chosen.length === 0) return;
    const response = await api.patch(graph, chosen);
    setGraph(response.graph);
    clearImprovements();
  };

  const regressions = chosen.filter((p) => {
    const record = p.id ? measured[p.id] : undefined;
    return record && record.losses > record.wins;
  }).length;

  return (
    <Flex direction="column" style={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      {!result && !askError && (
        <Flex align="center" justify="center" style={{ flex: 1 }}>
          <Button size="3" onClick={() => void findImprovements()} disabled={busy}>
            {busy ? "Looking" : "Find improvements"}
          </Button>
        </Flex>
      )}

      {(result || askError) && (
        <Flex px="4" py="2" justify="end">
          <Button
            size="1"
            variant="outline"
            onClick={() => void findImprovements()}
            disabled={busy}
          >
            {busy ? "Looking" : "Look again"}
          </Button>
        </Flex>
      )}

      {(error || askError) && (
        <Box px="4" py="2" style={{ background: "var(--red-2)" }}>
          <Text size="2" color="red">
            {error || askError}
          </Text>
        </Box>
      )}
      {result && !result.ok && (
        <Box px="4" py="2" style={{ background: "var(--red-2)" }}>
          <Text size="2" color="red">
            {result.error}
          </Text>
        </Box>
      )}

      <ScrollArea style={{ flex: 1, display: result ? undefined : "none" }}>
        <SampleEditor />

        {result?.summary && (
          <Box px="4" py="4" style={{ borderBottom: "1px solid var(--gray-6)" }}>
            <Text as="p" style={{ maxWidth: "72ch" }}>
              {result.summary}
            </Text>
            <Flex gap="4" mt="2">
              <Text size="2" color="gray" className="num">
                estimated {usd(result.baseline_usd)} per request
              </Text>
              {baselineUsd !== null && (
                <Text size="2" color="gray" className="num">
                  measured {usd(baselineUsd)} per request
                </Text>
              )}
            </Flex>
          </Box>
        )}

        {result?.patches.map((priced, index) => {
          const id = priced.patch.id ?? String(index);
          const record = measured[id];
          return (
            <Box
              key={id}
              px="4"
              py="4"
              style={{
                borderBottom: "1px solid var(--gray-6)",
                background: accepted.has(id) ? "var(--accent-2)" : undefined,
                opacity: priced.applies ? 1 : 0.5,
              }}
            >
              <Flex gap="3" align="start">
                <Checkbox
                  mt="1"
                  checked={accepted.has(id)}
                  disabled={!priced.applies}
                  onCheckedChange={() => {
                    void toggle(id);
                    if (priced.patch.node_id) setEditing(null);
                  }}
                />
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Flex align="baseline" gap="3">
                    <Text weight="medium" style={{ flex: 1 }}>
                      {priced.patch.title}
                    </Text>
                    <Text
                      size="2"
                      className="num"
                      color={record ? "gray" : priced.usd_delta < 0 ? "green" : "gray"}
                    >
                      est {signedUsd(priced.usd_delta)}
                    </Text>
                  </Flex>
                  <Text as="p" size="2" color="gray" mt="1" style={{ maxWidth: "68ch" }}>
                    {priced.patch.rationale}
                  </Text>
                  <Badge size="1" color="gray" variant="soft" mt="2">
                    {priced.patch.op.replace(/_/g, " ")}
                  </Badge>
                  {priced.problems.map((problem, i) => (
                    <Text key={i} as="p" size="2" color="red" mt="1">
                      {problem}
                    </Text>
                  ))}
                  {record && <Measured measured={record} />}
                  {measuring && accepted.has(id) && !record && (
                    <Text as="p" size="2" color="gray" mt="2">
                      Running the sample
                    </Text>
                  )}
                </Box>
              </Flex>
            </Box>
          );
        })}
      </ScrollArea>

      {accepted.size > 0 && (
        <Flex
          align="center"
          gap="3"
          px="4"
          py="3"
          style={{ borderTop: "1px solid var(--gray-6)", flexShrink: 0 }}
        >
          {measuring ? (
            <Button size="2" variant="outline" onClick={() => abort.current?.abort()}>
              <Square size={14} /> Stop
            </Button>
          ) : (
            <Button
              size="2"
              variant="outline"
              onClick={() => void measure()}
              disabled={!graph?.sample.length}
            >
              <FlaskConical size={15} /> Measure
              {plan ? ` ${usd(plan.projected_usd)}` : ""}
            </Button>
          )}
          {regressions > 0 && (
            <Badge color="red" size="2">
              {regressions} measured worse
            </Badge>
          )}
          <Flex flexGrow="1" />
          <Text size="2" color="gray" className="num">
            {accepted.size} selected
          </Text>
          <Button size="2" onClick={() => void applyChosen()}>
            Apply
          </Button>
        </Flex>
      )}
    </Flex>
  );
}

import { Flex, Text } from "@radix-ui/themes";
import { usd } from "@/lib/kinds";
import { useStore } from "@/store";

export function StatusLine() {
  const estimate = useStore((s) => s.estimate);
  const measured = useStore((s) => s.measured);

  if (!estimate) return null;

  const events = Object.values(measured);
  const spent = events.reduce((sum, event) => sum + (event.usd ?? 0), 0);
  const elapsed = events.reduce((sum, event) => sum + (event.ms ?? 0), 0);

  return (
    <Flex
      align="center"
      gap="6"
      px="4"
      style={{ height: 44, flexShrink: 0, borderTop: "1px solid var(--gray-6)" }}
    >
      <Text size="2" color="gray">
        Estimated{" "}
        <Text className="num" color="gray" highContrast>
          {usd(estimate.usd)}
        </Text>{" "}
        per request
      </Text>
      <Text size="2" color="gray" className="num">
        {estimate.input_tokens.toLocaleString()} tokens in,{" "}
        {estimate.output_tokens.toLocaleString()} out
      </Text>
      {events.length > 0 && (
        <Text size="2" color="gray">
          Measured{" "}
          <Text className="num" color="green">
            {usd(spent)}
          </Text>{" "}
          in{" "}
          <Text className="num" color="gray" highContrast>
            {(elapsed / 1000).toFixed(1)}s
          </Text>
        </Text>
      )}
    </Flex>
  );
}

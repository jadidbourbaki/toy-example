import { Badge, DataList, Heading, Text } from "@radix-ui/themes";
import { usd } from "@/lib/kinds";
import { useStore } from "@/store";

/** What the server was started with. These come from the environment, so
 *  the page reads them back rather than editing them. */
export function SettingsPage() {
  const health = useStore((s) => s.health);
  const models = useStore((s) => s.models);
  const label = (id: string) => models.find((m) => m.id === id)?.label || id;
  if (!health) return null;

  return (
    <>
      <Heading size="8" mb="6">
        Settings
      </Heading>
      <DataList.Root size="3">
        <DataList.Item>
          <DataList.Label>Model credentials</DataList.Label>
          <DataList.Value>
            <Badge color={health.model_credentials ? "green" : "red"} size="2">
              {health.model_credentials ? "Present" : "Missing"}
            </Badge>
          </DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Compiler</DataList.Label>
          <DataList.Value>{label(health.compiler_model)}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Judge</DataList.Label>
          <DataList.Value>{label(health.judge_model)}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Assistant</DataList.Label>
          <DataList.Value>{label(health.assistant_model)}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Measure budget</DataList.Label>
          <DataList.Value className="num">{usd(health.measure_budget_usd)}</DataList.Value>
        </DataList.Item>
        <DataList.Item>
          <DataList.Label>Workspace</DataList.Label>
          <DataList.Value>
            <Text className="num">{health.workspace}</Text>
          </DataList.Value>
        </DataList.Item>
      </DataList.Root>
    </>
  );
}

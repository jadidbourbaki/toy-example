import { Button, Flex, Text } from "@radix-ui/themes";
import { type Section, useStore } from "@/store";

const SECTIONS: [Section, string][] = [
  ["workflows", "Workflows"],
  ["templates", "Templates"],
  ["models", "Models"],
  ["settings", "Settings"],
];

export function Sidebar() {
  const section = useStore((s) => s.section);
  const setSection = useStore((s) => s.setSection);
  return (
    <Flex direction="column" gap="1" p="3" className="sidebar">
      <Text size="2" weight="bold" color="gray" mb="3" ml="3" mt="2">
        Workspace
      </Text>
      {SECTIONS.map(([id, label]) => {
        const active = id === section;
        return (
          <Button
            key={id}
            size="3"
            variant="soft"
            color="gray"
            highContrast={active}
            className="sidebar-item"
            data-active={active || undefined}
            onClick={() => setSection(id)}
            style={{ justifyContent: "flex-start" }}
          >
            {label}
          </Button>
        );
      })}
    </Flex>
  );
}

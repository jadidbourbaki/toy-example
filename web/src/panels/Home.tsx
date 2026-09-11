import { Container, Flex, ScrollArea } from "@radix-ui/themes";
import { ModelsPage } from "@/panels/ModelsPage";
import { SettingsPage } from "@/panels/SettingsPage";
import { Sidebar } from "@/panels/Sidebar";
import { TemplatesPage } from "@/panels/TemplatesPage";
import { WorkflowsPage } from "@/panels/WorkflowsPage";
import { useStore } from "@/store";

const PAGES = {
  workflows: WorkflowsPage,
  templates: TemplatesPage,
  models: ModelsPage,
  settings: SettingsPage,
};

/** The workspace: a sidebar of sections and the page for the one chosen. */
export function Home() {
  const section = useStore((s) => s.section);
  const Page = PAGES[section];
  return (
    <Flex style={{ height: "100vh" }}>
      <Sidebar />
      <ScrollArea style={{ flex: 1 }}>
        <Container size="4" px="8" py="8">
          <Page />
        </Container>
      </ScrollArea>
    </Flex>
  );
}

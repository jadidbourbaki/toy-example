import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { Canvas } from "@/Canvas";
import { ChatPanel } from "@/panels/ChatPanel";
import { Drawer } from "@/panels/Drawer";
import { Home } from "@/panels/Home";
import { StageModal } from "@/panels/StageModal";
import { TopBar } from "@/panels/TopBar";
import { useStore } from "@/store";

export function App() {
  const boot = useStore((s) => s.boot);
  const graph = useStore((s) => s.graph);
  const chatOpen = useStore((s) => s.chatOpen);
  const drawerOpen = useStore((s) => s.drawer.open);

  useEffect(() => {
    void boot();
  }, [boot]);

  if (!graph) return <Home />;

  return (
    <>
      <Group orientation="horizontal" style={{ height: "100vh" }}>
        <Panel minSize={520} className="column">
          <TopBar />
          <Group orientation="vertical" style={{ flex: 1, minHeight: 0 }}>
            <Panel minSize={240} className="column">
              <ReactFlowProvider>
                <Canvas />
              </ReactFlowProvider>
            </Panel>
            {drawerOpen && (
              <>
                <Separator className="separator" />
                <Panel defaultSize="40" minSize={160} className="column">
                  <Drawer />
                </Panel>
              </>
            )}
          </Group>
          {!drawerOpen && <Drawer />}
        </Panel>

        {chatOpen && (
          <>
            <Separator className="separator" />
            <Panel defaultSize={380} minSize={300} maxSize={720} className="column">
              <ChatPanel />
            </Panel>
          </>
        )}
      </Group>
      <StageModal />
    </>
  );
}

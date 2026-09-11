import { Flex } from "@radix-ui/themes";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
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

  useEffect(() => {
    void boot();
  }, [boot]);

  if (!graph) return <Home />;

  return (
    <Flex style={{ height: "100vh", overflow: "hidden" }}>
      <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
        <TopBar />
        <Flex direction="column" style={{ flex: 3, minHeight: 0 }}>
          <ReactFlowProvider>
            <Canvas />
          </ReactFlowProvider>
        </Flex>
        <Drawer />
      </Flex>

      {chatOpen && <ChatPanel />}
      <StageModal />
    </Flex>
  );
}

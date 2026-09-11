import { Flex, IconButton, Tabs } from "@radix-ui/themes";
import { ChevronDown, ChevronUp } from "lucide-react";
import { CodePanel } from "@/panels/CodePanel";
import { OptimizePanel } from "@/panels/OptimizePanel";
import { type DrawerTab, useStore } from "@/store";

/** Code and Optimizations under the canvas. The drawer appears once either
 *  has something to show and folds down to its tab strip. Both panels stay
 *  mounted while folded, so a half-measured set of patches survives. */
export function Drawer() {
  const { tab, open } = useStore((s) => s.drawer);
  const setDrawer = useStore((s) => s.setDrawer);
  const compile = useStore((s) => s.compile);
  const optimize = useStore((s) => s.optimize);

  const hasContent =
    compile.running || compile.result !== null || optimize.busy || optimize.result !== null;
  if (!hasContent && !open) return null;

  return (
    <Flex
      direction="column"
      style={{
        flex: open ? 2 : "0 0 auto",
        minHeight: 0,
        borderTop: "1px solid var(--gray-6)",
      }}
    >
      <Flex align="center" px="3" className="drawer-strip">
        <Tabs.Root value={tab} onValueChange={(value) => setDrawer(value as DrawerTab, true)}>
          <Tabs.List size="2">
            <Tabs.Trigger value="code">Code</Tabs.Trigger>
            <Tabs.Trigger value="optimize">Optimizations</Tabs.Trigger>
          </Tabs.List>
        </Tabs.Root>
        <IconButton
          size="2"
          variant="ghost"
          color="gray"
          ml="auto"
          onClick={() => setDrawer(tab, !open)}
        >
          {open ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </IconButton>
      </Flex>
      <div style={{ display: open && tab === "code" ? "flex" : "none", flex: 1, minHeight: 0 }}>
        <CodePanel />
      </div>
      <div style={{ display: open && tab === "optimize" ? "flex" : "none", flex: 1, minHeight: 0 }}>
        <OptimizePanel key={optimize.run} />
      </div>
    </Flex>
  );
}

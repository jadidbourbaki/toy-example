import { Flex, IconButton, SegmentedControl, Text } from "@radix-ui/themes";
import { ChevronDown, ChevronUp } from "lucide-react";
import { usd } from "@/lib/kinds";
import { CodePanel } from "@/panels/CodePanel";
import { OptimizePanel } from "@/panels/OptimizePanel";
import { type DrawerTab, useStore } from "@/store";

/** Code and Optimizations under the canvas. The strip is always there and
 *  carries the estimate the optimizer works against, a tab opens its pane,
 *  and both panes stay mounted while folded so a half-measured set of
 *  patches survives. */
export function Drawer() {
  const { tab, open } = useStore((s) => s.drawer);
  const setDrawer = useStore((s) => s.setDrawer);
  const optimize = useStore((s) => s.optimize);
  const estimate = useStore((s) => s.estimate);

  return (
    <Flex
      direction="column"
      style={{ flex: open ? 1 : "0 0 auto", minHeight: 0, borderTop: "1px solid var(--gray-6)" }}
    >
      <Flex align="center" px="4" className="drawer-strip">
        <SegmentedControl.Root
          size="3"
          value={open ? tab : ""}
          onValueChange={(value) => value && setDrawer(value as DrawerTab, true)}
        >
          <SegmentedControl.Item value="code">Code</SegmentedControl.Item>
          <SegmentedControl.Item value="optimize">Optimizations</SegmentedControl.Item>
        </SegmentedControl.Root>
        {estimate && (
          <Text size="3" color="gray" className="num">
            {usd(estimate.usd)} per request
          </Text>
        )}
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

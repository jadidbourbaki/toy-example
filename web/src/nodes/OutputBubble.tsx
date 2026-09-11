import { Popover, ScrollArea, Text } from "@radix-ui/themes";

export type OutputBubbleProps = { text: string };

/** What a stage produced, hanging under it like speech. The bubble shows the
 *  opening lines and opens to the whole text. The nodrag class keeps a click
 *  on it from dragging the stage. */
export function OutputBubble({ text }: OutputBubbleProps) {
  return (
    <Popover.Root>
      <Popover.Trigger>
        <button
          className="output-bubble nodrag nopan"
          onClick={(event) => event.stopPropagation()}
          onDoubleClick={(event) => event.stopPropagation()}
        >
          <span className="clamp">{text}</span>
        </button>
      </Popover.Trigger>
      <Popover.Content size="2" maxWidth="520px" className="nodrag nopan">
        <ScrollArea style={{ maxHeight: 360 }}>
          <Text size="2" style={{ whiteSpace: "pre-wrap" }}>
            {text}
          </Text>
        </ScrollArea>
      </Popover.Content>
    </Popover.Root>
  );
}

import { Button, Flex, Heading } from "@radix-ui/themes";
import { AlertTriangle, BookOpen, Coins, Scissors, type LucideIcon } from "lucide-react";

export type ChatEmptyProps = { onPick: (question: string) => void };

const STARTERS: [LucideIcon, string][] = [
  [BookOpen, "Explain this workflow"],
  [Coins, "Where does the cost go?"],
  [AlertTriangle, "What could go wrong here?"],
  [Scissors, "How could this be cheaper?"],
];

/** The chat before anything has been asked: questions worth starting with. */
export function ChatEmpty({ onPick }: ChatEmptyProps) {
  return (
    <Flex direction="column" gap="3" px="3" pb="3" style={{ marginTop: "auto" }}>
      <Heading size="4" ml="2">
        How can I help?
      </Heading>
      <Flex direction="column" align="start" gap="1">
        {STARTERS.map(([Icon, question]) => (
          <Button
            key={question}
            size="3"
            variant="ghost"
            color="gray"
            highContrast
            className="chat-starter"
            onClick={() => onPick(question)}
          >
            <Icon size={18} strokeWidth={1.75} />
            {question}
          </Button>
        ))}
      </Flex>
    </Flex>
  );
}

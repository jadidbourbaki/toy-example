import { IconButton } from "@radix-ui/themes";
import { Panel } from "@xyflow/react";
import { MessageCircle } from "lucide-react";
import { useStore } from "@/store";

/** The way into the chat, in the corner of the canvas until the chat is open. */
export function ChatToggle() {
  const chatOpen = useStore((s) => s.chatOpen);
  const toggleChat = useStore((s) => s.toggleChat);
  if (chatOpen) return null;
  return (
    <Panel position="bottom-right">
      <IconButton size="4" radius="full" onClick={toggleChat} className="chat-toggle">
        <MessageCircle size={24} />
      </IconButton>
    </Panel>
  );
}

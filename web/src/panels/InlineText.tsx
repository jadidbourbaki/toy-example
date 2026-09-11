import { Text, TextField } from "@radix-ui/themes";
import { Pencil } from "lucide-react";
import { useState } from "react";

export type InlineTextProps = {
  value: string;
  onCommit: (value: string) => void;
};

/** A name that reads as text until it is clicked, and then is a field. A
 *  pencil shows on hover so the text looks editable before it is touched.
 *  Enter or leaving the field keeps the edit, and Escape drops it. */
export function InlineText({ value, onCommit }: InlineTextProps) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft !== null && draft.trim() && draft.trim() !== value) onCommit(draft.trim());
    setDraft(null);
  };

  if (draft !== null) {
    return (
      <TextField.Root
        autoFocus
        size="2"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setDraft(null);
        }}
        style={{ width: "32ch" }}
      />
    );
  }

  return (
    <button className="inline-text" onClick={() => setDraft(value)}>
      <Text size="4" weight="bold" truncate>
        {value}
      </Text>
      <Pencil size={14} className="inline-text-pencil" />
    </button>
  );
}

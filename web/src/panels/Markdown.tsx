import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export type MarkdownProps = { text: string };

/** Model output rendered as the markdown it usually is. */
export function Markdown({ text }: MarkdownProps) {
  return (
    <div className="markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  );
}

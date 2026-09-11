import { useEffect, useState } from "react";
import { highlightPython } from "@/lib/highlight";

export type SourceViewProps = { source: string };

/** A compiled module with its syntax coloured. Shiki escapes the source, so
 *  the HTML it hands back is its own and safe to place. */
export function SourceView({ source }: SourceViewProps) {
  const [html, setHtml] = useState("");

  useEffect(() => {
    let live = true;
    void highlightPython(source).then((result) => {
      if (live) setHtml(result);
    });
    return () => {
      live = false;
    };
  }, [source]);

  if (!html) return <pre className="source-view">{source}</pre>;
  return <div className="source-view" dangerouslySetInnerHTML={{ __html: html }} />;
}

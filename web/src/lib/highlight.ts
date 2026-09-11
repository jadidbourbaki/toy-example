import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { bundledLanguages } from "shiki/langs";
import { bundledThemes } from "shiki/themes";

/** One highlighter for the app, carrying Python and one light theme and
 *  nothing else, so the grammar bundle stays small. */
let highlighter: Promise<HighlighterCore> | undefined;

export function highlightPython(source: string): Promise<string> {
  highlighter ??= createHighlighterCore({
    langs: [bundledLanguages.python],
    themes: [bundledThemes["github-light"]],
    engine: createJavaScriptRegexEngine(),
  });
  return highlighter.then((h) => h.codeToHtml(source, { lang: "python", theme: "github-light" }));
}

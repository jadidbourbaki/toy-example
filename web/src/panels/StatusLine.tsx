import { usd } from "@/lib/kinds";
import { useStore } from "@/store";

/** One line of numbers under the canvas. Estimated cost while you edit, and
 *  measured cost once a run has happened. */
export function StatusLine() {
  const estimate = useStore((s) => s.estimate);
  const measured = useStore((s) => s.measured);

  if (!estimate) return null;

  const events = Object.values(measured);
  const spent = events.reduce((sum, event) => sum + (event.usd ?? 0), 0);
  const elapsed = events.reduce((sum, event) => sum + (event.ms ?? 0), 0);

  return (
    <div className="flex h-9 shrink-0 items-center gap-5 border-t border-line bg-panel px-4 text-[12px]">
      <span className="text-mute">
        Estimated <span className="num text-ink">{usd(estimate.usd)}</span> per request
      </span>
      <span className="num text-faint">
        {estimate.input_tokens.toLocaleString()} in · {estimate.output_tokens.toLocaleString()} out
      </span>
      {events.length > 0 && (
        <>
          <span className="h-3 w-px bg-line" />
          <span className="text-mute">
            Measured <span className="num text-good">{usd(spent)}</span> per request
          </span>
          <span className="num text-faint">{(elapsed / 1000).toFixed(1)}s</span>
        </>
      )}
    </div>
  );
}

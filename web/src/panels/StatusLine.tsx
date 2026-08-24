import { usd } from "@/lib/kinds";
import { useStore } from "@/store";

export function StatusLine() {
  const estimate = useStore((s) => s.estimate);
  const measured = useStore((s) => s.measured);

  if (!estimate) return null;

  const events = Object.values(measured);
  const spent = events.reduce((sum, event) => sum + (event.usd ?? 0), 0);
  const elapsed = events.reduce((sum, event) => sum + (event.ms ?? 0), 0);

  return (
    <div className="flex h-10 shrink-0 items-center gap-6 border-t border-border px-4 text-[14px] text-muted-foreground">
      <span>
        Estimated <span className="num text-foreground">{usd(estimate.usd)}</span> per request
      </span>
      <span className="num text-muted-foreground">
        {estimate.input_tokens.toLocaleString()} tokens in,{" "}
        {estimate.output_tokens.toLocaleString()} out
      </span>
      {events.length > 0 && (
        <span>
          Measured <span className="num text-primary">{usd(spent)}</span> in{" "}
          <span className="num">{(elapsed / 1000).toFixed(1)}s</span>
        </span>
      )}
    </div>
  );
}

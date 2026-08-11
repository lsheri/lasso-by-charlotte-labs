import { ChevronRight } from "lucide-react";
import { useState } from "react";

/**
 * A sticky-headed section of the work page. Needs-mapping opens by default;
 * settled work (mapped, private) stays folded away until asked for.
 */
export function WorkSection({
  label,
  hint,
  count,
  defaultOpen = false,
  accessory,
  children,
}: {
  label: string;
  hint?: string;
  count: number;
  defaultOpen?: boolean;
  accessory?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section>
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-x-3 gap-y-2 bg-background/95 px-1 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <ChevronRight
            className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden
          />
          <span className="micro-label truncate">{label}</span>
          <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            {count}
          </span>
        </button>
        {accessory ? <div className="ml-auto flex items-center gap-3">{accessory}</div> : null}
      </div>
      {hint && open ? <p className="mb-2 text-xs text-muted-foreground">{hint}</p> : null}
      {open ? <div className="space-y-2">{children}</div> : null}
    </section>
  );
}

/** One engagement's worth of mapped work, folded by default. */
export function EngagementFold({
  label,
  hue,
  count,
  children,
}: {
  label: string;
  hue: string;
  count: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-[var(--radius)] border border-border bg-card/60">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <ChevronRight
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
            open ? "rotate-90" : ""
          }`}
          aria-hidden
        />
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: `var(${hue})` }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{label}</span>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {count} item{count === 1 ? "" : "s"}
        </span>
      </button>
      {open ? <div className="space-y-2 px-2 pb-2">{children}</div> : null}
    </div>
  );
}

import { useState, type ReactNode } from "react";

import { GraphiteIcon } from "@/components/notebook/icons";

/**
 * An orange sticky note on the engagement page. Shut by default: the page
 * reads as a title and a canvas, and the notes open only when you want to
 * change something.
 */
export function EngagementNote({
  title,
  summary,
  children,
  defaultOpen = false,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="nb-note" data-open={open ? "true" : "false"}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="nb-note-head"
      >
        <span className="min-w-0">
          <span className="micro-label block">{title}</span>
          {summary ? (
            <span className="mt-0.5 block truncate text-sm text-foreground">{summary}</span>
          ) : null}
        </span>
        <GraphiteIcon name="chevron-right" size={16} className="nb-note-caret shrink-0" />
      </button>
      {open ? <div className="nb-note-body">{children}</div> : null}
    </section>
  );
}

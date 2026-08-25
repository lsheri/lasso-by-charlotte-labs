import { type ReactNode } from "react";

import { GraphiteIcon } from "@/components/notebook/icons";

/**
 * A sticky note on the engagement page. Shut by default: the page reads as a
 * title and a canvas, and the note opens only when you want to change
 * something. It opens on its own, and it wears its own paper colour.
 */
export function EngagementNote({
  title,
  summary,
  children,
  tone,
  open,
  onToggle,
  action,
}: {
  title: string;
  summary?: string;
  children: ReactNode;
  tone: "green";
  open: boolean;
  onToggle: () => void;
  /** A small control on the title row, such as the brief's pencil. */
  action?: ReactNode;
}) {
  return (
    <section className="nb-note" data-tone={tone} data-open={open ? "true" : "false"}>
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="nb-note-head min-w-0 flex-1"
        >
          <span className="min-w-0">
            <span className="micro-label block">{title}</span>
            {summary ? (
              <span className="mt-0.5 block truncate text-sm text-foreground">{summary}</span>
            ) : null}
          </span>
          <GraphiteIcon name="chevron-right" size={16} className="nb-note-caret shrink-0" />
        </button>
        {action ? <div className="shrink-0 pr-3">{action}</div> : null}
      </div>
      {open ? <div className="nb-note-body">{children}</div> : null}
    </section>
  );
}

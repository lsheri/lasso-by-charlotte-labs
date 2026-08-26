import { Link } from "@tanstack/react-router";

import { GraphiteCheck, GraphiteRule } from "@/components/notebook/marks";
import { useMyDeliverables } from "@/hooks/use-my-deliverables";
import { WORKSTREAM_STATUS_LABELS } from "@/lib/workstream-status";
import {
  LOCKED_EMPTY_LINE,
  LOCKED_SECTION_LABEL,
  OPEN_EMPTY_LINE,
  OPEN_SECTION_LABEL,
  partitionDeliverables,
  type DeliverableCardRow,
} from "@/lib/overview-work-shared";

const CARD_STAGGER_MS = 60;

/** Where a deliverable belongs, said the way the sidebar says it. */
function whereLine(row: DeliverableCardRow): string {
  return [row.client_label, row.engagement_code, row.engagement_title]
    .filter(Boolean)
    .join(" · ");
}

function DeliverableCard({
  row,
  locked,
  delayMs,
}: {
  row: DeliverableCardRow;
  locked: boolean;
  delayMs: number;
}) {
  const statusLabel = row.shipped
    ? "Shipped to the firm"
    : (WORKSTREAM_STATUS_LABELS[row.status] ?? "Open");

  return (
    <Link
      to="/engagements/$id"
      params={{ id: row.engagement_id }}
      data-testid={`deliverable-card-${row.id}`}
      data-locked={locked ? "1" : "0"}
      className={`nb-rise relative block w-[260px] shrink-0 overflow-hidden rounded-[var(--radius)] border border-border bg-card p-4 text-left ${
        locked ? "nb-card--locked" : "hover:border-accent-deep"
      }`}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      {locked ? (
        <>
          <GraphiteCheck
            seed={row.id}
            className="absolute right-3 top-3 text-muted-foreground"
          />
          <span className="nb-fold-corner" data-testid={`deliverable-fold-${row.id}`} />
        </>
      ) : null}

      <span
        className={`block break-words pr-6 text-sm font-medium text-foreground ${
          locked ? "nb-locked-title" : ""
        }`}
        data-testid={`deliverable-title-${row.id}`}
      >
        {row.name}
      </span>
      <GraphiteRule className="mt-1 h-[6px] w-[120px] text-muted-foreground" />
      <span className={`mt-1.5 block ${locked ? "nb-locked-body" : ""}`}>
        <span className="block font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {statusLabel}
        </span>
        {whereLine(row) ? (
          <span className="mt-1 block text-xs text-muted-foreground">{whereLine(row)}</span>
        ) : null}
      </span>
    </Link>
  );
}

function Section({
  label,
  rows,
  locked,
  emptyLine,
  startDelayMs,
  testId,
}: {
  label: string;
  rows: DeliverableCardRow[];
  locked: boolean;
  emptyLine: string;
  startDelayMs: number;
  testId: string;
}) {
  return (
    <section data-testid={testId} className="mt-8">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </h2>
      <div style={{ animationDelay: `${startDelayMs}ms` }} className="nb-rule-draw">
        <GraphiteRule className="mt-1 h-[6px] w-full text-muted-foreground" />
      </div>

      {rows.length === 0 ? (
        <p
          data-testid={`${testId}-empty`}
          className="mt-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground opacity-60"
        >
          {emptyLine}
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-3">
          {rows.map((row, index) => (
            <DeliverableCard
              key={row.id}
              row={row}
              locked={locked}
              delayMs={startDelayMs + 400 + index * CARD_STAGGER_MS}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** Two stacked sections: what is still moving, and what has settled. */
export function OverviewWork() {
  const { data } = useMyDeliverables();
  const { open, locked } = partitionDeliverables(data ?? []);

  return (
    <div data-testid="overview-work">
      <Section
        label={OPEN_SECTION_LABEL}
        rows={open}
        locked={false}
        emptyLine={OPEN_EMPTY_LINE}
        startDelayMs={0}
        testId="overview-open"
      />
      <Section
        label={LOCKED_SECTION_LABEL}
        rows={locked}
        locked
        emptyLine={LOCKED_EMPTY_LINE}
        startDelayMs={120}
        testId="overview-locked"
      />
    </div>
  );
}

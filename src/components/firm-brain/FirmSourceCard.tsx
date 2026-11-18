import { FIRM_ASK_COPY, FIRM_TYPE_LABELS, firmDate, type FirmAskSource } from "@/lib/firm-ask-shared";

/**
 * One source under a firm answer: board, item, type, date, and the "Shown to client" mark when the firm showed it.
 * Opens a read-only preview served by the firm reader, never the board (most askers cannot open other boards).
 */
export function FirmSourceCard({
  source,
  grade,
  onOpen,
}: {
  source: FirmAskSource;
  grade: "quoted" | "from_summary";
  onOpen: () => void;
}) {
  // A close-out lesson is the engagement's own line, not an item: nothing to open.
  const Tag = source.type === "outcome" ? "div" : "button";
  return (
    <Tag
      {...(Tag === "button" ? { type: "button" as const, onClick: onOpen } : {})}
      data-firm-source={grade}
      className="flex w-full min-w-0 flex-col gap-0.5 rounded-[var(--radius)] border border-border bg-background px-3 py-2 text-left hover:border-foreground/40 focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <span className="truncate text-(length:--type-small) text-muted-foreground">{source.boardTitle}</span>
      <span className="truncate text-(length:--type-body) font-medium text-foreground">{source.title}</span>
      <span className="flex flex-wrap items-center gap-x-2 font-mono text-(length:--type-label) uppercase tracking-[0.06em] text-muted-foreground">
        <span>{FIRM_TYPE_LABELS[source.type] ?? source.type}</span>
        {source.date ? <span>{firmDate(source.date)}</span> : null}
        <span>{grade === "quoted" ? FIRM_ASK_COPY.quoted : FIRM_ASK_COPY.fromSummary}</span>
        {source.shownOn ? <span data-firm-source-shown className="text-foreground">{`${FIRM_ASK_COPY.shown}, ${firmDate(source.shownOn)}`}</span> : null}
      </span>
    </Tag>
  );
}

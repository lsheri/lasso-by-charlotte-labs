/** Never truncate silently: say plainly how much of the record was read. */
export function CoverageNote({
  fullCount,
  summaryCount,
  noTextCount = 0,
  share,
  compact = false,
}: {
  fullCount: number;
  summaryCount: number;
  /** TOTAL-2: items in the read set with nothing stored to read; never a choice Lasso made. */
  noTextCount?: number;
  /** TOTAL-2: share of the selected text that reached the model, 0 to 1. */
  share?: number | null;
  /**
   * V2-2e (ask-v2): the receipt above already says how many were read ("Read 1 of 3"), so
   * say only what it does not: why the rest were not read, and how much text was cut.
   */
  compact?: boolean;
}) {
  if (fullCount === 0 && summaryCount === 0 && noTextCount === 0) return null;
  if (compact) return <CompactCoverageNote summaryCount={summaryCount} noTextCount={noTextCount} share={share} />;
  const parts: string[] = [`Read as written: ${fullCount} ${fullCount === 1 ? "item" : "items"}`];
  if (summaryCount > 0) parts.push(`Read as summary only: ${summaryCount} ${summaryCount === 1 ? "item" : "items"}`);
  if (noTextCount > 0) parts.push(`No stored text: ${noTextCount} ${noTextCount === 1 ? "item" : "items"}`);
  const pct = typeof share === "number" && Number.isFinite(share) ? Math.round(share * 100) : null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="coverage-note">
      {parts.join(". ")}.{pct !== null ? ` ${pct}% of the selected text was in front of Lasso.` : ""}
    </p>
  );
}

const itemsWord = (n: number) => `${n} ${n === 1 ? "item" : "items"}`;

/** V2-2e: the note under a receipt. Nothing the receipt already says; nothing at all when there is nothing to add. */
export function compactCoverageLine({ summaryCount, noTextCount, share }: { summaryCount: number; noTextCount: number; share?: number | null | undefined }): string | null {
  const parts: string[] = [];
  if (summaryCount > 0) parts.push(`${itemsWord(summaryCount)} read as summary only`);
  if (noTextCount > 0) parts.push(`${itemsWord(noTextCount)} with no stored text`);
  const pct = typeof share === "number" && Number.isFinite(share) ? Math.round(share * 100) : null;
  if (pct !== null && pct < 100) parts.push(`${pct}% of the selected text was in front of Lasso`);
  if (parts.length === 0) return null;
  const line = parts.join(". ");
  return `${line.charAt(0).toUpperCase()}${line.slice(1)}.`;
}

function CompactCoverageNote(props: { summaryCount: number; noTextCount: number; share?: number | null | undefined }) {
  const line = compactCoverageLine(props);
  if (!line) return null;
  return (
    <p className="text-xs text-muted-foreground" data-testid="coverage-note" data-compact="true">
      {line}
    </p>
  );
}

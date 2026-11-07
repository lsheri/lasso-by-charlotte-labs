/** Never truncate silently: say plainly how much of the record was read. */
export function CoverageNote({
  fullCount,
  summaryCount,
  noTextCount = 0,
  share,
}: {
  fullCount: number;
  summaryCount: number;
  /** TOTAL-2: items in the read set with nothing stored to read; never a choice Lasso made. */
  noTextCount?: number;
  /** TOTAL-2: share of the selected text that reached the model, 0 to 1. */
  share?: number | null;
}) {
  if (fullCount === 0 && summaryCount === 0 && noTextCount === 0) return null;
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

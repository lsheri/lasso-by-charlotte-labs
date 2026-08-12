/** Never truncate silently: say plainly how much of the record was read. */
export function CoverageNote({
  fullCount,
  summaryCount,
}: {
  fullCount: number;
  summaryCount: number;
}) {
  if (fullCount === 0 && summaryCount === 0) return null;
  return (
    <p className="text-xs text-muted-foreground">
      Read in full: {fullCount} {fullCount === 1 ? "item" : "items"}. Read as summary only:{" "}
      {summaryCount} {summaryCount === 1 ? "item" : "items"}.
    </p>
  );
}

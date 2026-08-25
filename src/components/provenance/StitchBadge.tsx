/**
 * The pairing mark. One question wears the same small pencil badge in three
 * places: on the page where it was circled, on its answer card, and on the
 * source turn it landed in. The number is what ties a circle to an answer.
 */
export function StitchBadge({
  n,
  stitchId,
  filled = false,
  onClick,
  className = "",
  where = "card",
}: {
  n: number;
  stitchId: string;
  /** Lit while the pairing is hovered on the other side. */
  filled?: boolean;
  onClick?: () => void;
  className?: string;
  where?: "card" | "ink" | "turn";
}) {
  const shared =
    "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border text-[10px] font-medium leading-none nb-stitch-badge";
  const style = {
    borderColor: "var(--nb-ink-yellow)",
    backgroundColor: filled ? "var(--nb-ink-yellow)" : "var(--card)",
    color: "var(--foreground)",
  };
  const props = {
    "data-stitch-id": stitchId,
    "data-testid": `stitch-badge-${where}-${stitchId}`,
    "aria-label": `Question ${n}`,
    className: `${shared} ${className}`,
    style,
  };

  if (!onClick) return <span {...props}>{n}</span>;
  return (
    <button type="button" onClick={onClick} {...props}>
      {n}
    </button>
  );
}

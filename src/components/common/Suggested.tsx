/**
 * The suggestion treatment: "Lasso suggested this, a person decides."
 *
 * Surface only, a neon left edge, a wash, and a dot before the label. The
 * neon is never used as text colour (it lands near 1.3:1 on bone), so every
 * word inside stays foreground or ember-deep and passes AA.
 */
export function Suggested({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[var(--radius-md)] border-l-[3px] px-3 py-2 ${className}`}
      style={{
        background: "var(--suggest-wash)",
        borderLeftColor: "var(--suggest-edge)",
      }}
    >
      {children}
    </div>
  );
}

/** The neon dot that marks a suggested label. Decorative only. */
export function SuggestDot() {
  return (
    <span
      aria-hidden
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: "var(--suggest)", boxShadow: "0 0 0 1px var(--suggest-edge)" }}
    />
  );
}

/** Said once, where suggestions first appear. */
export function SuggestLegend({ className = "" }: { className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-xs text-muted-foreground ${className}`}>
      <SuggestDot />
      Green means Lasso suggested it. Nothing is saved until you confirm.
    </p>
  );
}

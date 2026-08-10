export function Wordmark({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <div className="rounded-[var(--radius)] bg-navy px-4 py-4">
      <div
        className={
          size === "lg"
            ? "font-mono text-2xl tracking-[0.3em] text-mint"
            : "font-mono text-lg tracking-[0.28em] text-mint"
        }
      >
        LASSO
      </div>
      <div className="mt-1 text-xs text-cream/80">by Charlotte Labs</div>
    </div>
  );
}
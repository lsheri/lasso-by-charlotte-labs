export function LauncherPill({
  complete,
  total,
  onOpen,
  className,
}: {
  complete: number;
  total: number;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open getting started"
      className={
        className ??
        "font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      Getting started {complete}/{total}
    </button>
  );
}

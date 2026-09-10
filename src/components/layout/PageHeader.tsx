export function PageHeader({
  title,
  subtitle,
  italicWord,
  action,
}: {
  title: string;
  /**
   * Widened from `string` to `ReactNode` so a page can pass a small component
   * that owns its own read (see `WorkSubtitle`). Every existing caller passes a
   * string, which is still a valid ReactNode, so nothing else changes.
   */
  subtitle: React.ReactNode;
  /** Figma PageHeader carries exactly one italic word after the title. */
  italicWord?: string;
  /**
   * Figma 22:220 hangs a single quiet control off the title's baseline at the
   * far right. Optional, so headers without one are unchanged.
   */
  action?: React.ReactNode;
}) {
  return (
    <header className="mb-8">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="page-title">
            {title}
            {italicWord ? <> <em className="italic">{italicWord}</em></> : null}
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

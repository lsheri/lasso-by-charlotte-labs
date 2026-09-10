export function PageHeader({
  title,
  subtitle,
  italicWord,
}: {
  title: string;
  subtitle: string;
  /** Figma PageHeader carries exactly one italic word after the title. */
  italicWord?: string;
}) {
  return (
    <header className="mb-8">
      <h1 className="page-title">
        {title}
        {italicWord ? <> <em className="italic">{italicWord}</em></> : null}
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
    </header>
  );
}

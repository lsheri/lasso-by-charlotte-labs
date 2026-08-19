/**
 * Required content, not decoration. It sits above every number so the first
 * thing an admin reads is what this view can never show them.
 */
export function PrivacyPanel() {
  return (
    <section className="rounded-[var(--radius)] border border-border bg-muted/40 px-5 py-4">
      <h2 className="micro-label">What this view can and cannot show</h2>
      <p className="mt-2 text-sm text-foreground">
        This page shows counts and structure for the workspace as a whole. It is built so that the
        work itself stays with the person who did it.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        <li>Never the work: no documents, decks, files, or captured threads.</li>
        <li>Never a conversation with Lasso, and never a prompt someone wrote.</li>
        <li>Never a number attached to a person&apos;s name, and never a ranking of people.</li>
        <li>Never a pass rate or a score, here or anywhere else in Lasso.</li>
        <li>
          Work that has not been shared is invisible here by construction, not by setting. There is
          no switch that turns it on.
        </li>
      </ul>
      <p className="mt-3 text-sm text-muted-foreground">
        Where a count would be small enough to point at one person, the number is withheld and the
        page says so instead.
      </p>
    </section>
  );
}

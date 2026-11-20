import { Lock } from "@/design/brand/icons";
import { WIN_COPY } from "@/lib/proposal-desk-shared";

/** How many documents are drawn before the rest fold into one "and N more" card. */
export const WIN_PICTURE_MAX = 4;

export const WIN_PICTURE_COPY = {
  brief: "Brief",
  briefFrom: "From your notes",
  document: "Document",
  more: (count: number) => `and ${count} more`,
  caption: (documents: number) =>
    documents === 0
      ? "The team board starts with your notes as its brief."
      : `The team board starts with your notes as its brief and your ${documents === 1 ? "document" : `${documents} documents`}.`,
  /** Says no more than the sentence it replaces: "Private" alone would promise more than the product does. */
  private: "Not shared with the firm",
  privateLine: "until you choose. People you add to the board can open these documents.",
} as const;

/**
 * 20 Nov 2026, redraw step 7: what recording the win makes, drawn as the small board it makes rather than told in
 * two paragraphs. The drawing only decorates: the full sentence that was there before is still read to a screen
 * reader, and the caption says the same thing in fewer words. Titles are the person's own documents (the server
 * sends them only for their own proposals); with no titles the cards are counted and unnamed.
 */
export function WinPicture({ count, titles }: { count: number; titles?: string[] | undefined }) {
  const named = (titles ?? []).filter(Boolean);
  const total = Math.max(count, named.length);
  const shown = Math.min(total, WIN_PICTURE_MAX);
  const cards = Array.from({ length: shown }, (_, index) => named[index] ?? "");
  const rest = total - shown;
  return (
    <div data-win-picture className="flex flex-col gap-3">
      <p className="sr-only">{WIN_COPY.body(count)}</p>
      <div
        aria-hidden="true"
        data-win-board
        className="grid grid-cols-2 gap-2 rounded-[var(--radius)] border border-border bg-muted p-3 sm:grid-cols-3"
      >
        <div data-win-card="brief" className="flex min-h-16 min-w-0 flex-col justify-between rounded-[var(--radius-control)] border border-border bg-card p-2 shadow-card">
          <span className="text-(length:--type-small) font-semibold text-foreground">{WIN_PICTURE_COPY.brief}</span>
          <span className="text-(length:--type-small) text-muted-foreground">{WIN_PICTURE_COPY.briefFrom}</span>
        </div>
        {cards.map((title, index) => (
          <div
            key={`${index}-${title}`}
            data-win-card="document"
            className="flex min-h-16 min-w-0 flex-col justify-between rounded-[var(--radius-control)] border border-border bg-card p-2 shadow-card"
          >
            <span className="line-clamp-2 break-words text-(length:--type-small) text-foreground [overflow-wrap:anywhere]">
              {title || WIN_PICTURE_COPY.document}
            </span>
          </div>
        ))}
        {rest > 0 ? (
          <div data-win-card="more" className="flex min-h-16 min-w-0 items-center justify-center rounded-[var(--radius-control)] border border-dashed border-border p-2">
            <span className="text-(length:--type-small) text-muted-foreground">{WIN_PICTURE_COPY.more(rest)}</span>
          </div>
        ) : null}
      </div>
      <p aria-hidden="true" data-win-caption className="text-sm text-foreground">
        {WIN_PICTURE_COPY.caption(total)}
      </p>
      <p data-win-private className="flex items-start gap-2 text-sm text-foreground">
        <Lock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          <strong className="font-semibold">{WIN_PICTURE_COPY.private}</strong>
          {" "}
          {WIN_PICTURE_COPY.privateLine}
        </span>
      </p>
    </div>
  );
}

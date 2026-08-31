import { CARD_FILE_FORMAT_ICON_SIZE, FileFormatIcon } from "@/components/work/FileFormatIcon";
import { avatarColorFor, initialsOf, kindChipTint } from "@/lib/card-meta";

/**
 * Pass 142: the metadata sub-card. Row one is the deliverable, row two is the
 * person who shipped it. It sits at the bottom of a card as its own tile so the
 * title above it can stay a title.
 */
export function CardMetaTile({
  testId,
  kindTestId,
  fileItem,
  kindTag,
  meta,
  type,
  filename,
  clientLabel,
  engagementCode,
  shipperId,
  shipperName,
  dateLabel,
}: {
  testId: string;
  /** Kept stable for cards whose kind chip is pinned by tests. */
  kindTestId?: string;
  /** Whatever the file format icon needs to name the end product. */
  fileItem: unknown;
  kindTag: string;
  meta: unknown;
  type: string | null | undefined;
  filename: string;
  clientLabel?: string | null | undefined;
  engagementCode?: string | null | undefined;
  shipperId?: string | null | undefined;
  shipperName?: string | null | undefined;
  dateLabel?: string | null | undefined;
}) {
  const tint = kindChipTint(meta, type);
  const initials = initialsOf(shipperName);
  const avatarColor = avatarColorFor(shipperId);
  const hasWho = Boolean(shipperName || dateLabel);

  return (
    <span
      data-testid={testId}
      className="mt-3 block rounded-[6px] border border-[var(--nb-rule)] bg-[var(--nb-grey-1)] px-2.5 py-2"
    >
      <span className="flex items-start gap-2">
        <FileFormatIcon item={fileItem as never} size={CARD_FILE_FORMAT_ICON_SIZE} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span
              data-testid={kindTestId ?? `${testId}-kind`}
              className="rounded-sm px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.08em]"
              style={{ backgroundColor: tint.background, color: tint.color }}
            >
              {kindTag}
            </span>
            <span className="min-w-0 break-all font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--nb-graphite)]">
              {filename}
            </span>
          </span>
          {clientLabel || engagementCode ? (
            <span className="mt-0.5 block font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--nb-soft)]">
              {clientLabel ?? ""}
              {clientLabel && engagementCode ? " · " : ""}
              <span className="font-semibold text-[var(--nb-green)]">{engagementCode ?? ""}</span>
            </span>
          ) : null}
        </span>
      </span>

      {hasWho ? (
        <span className="mt-2 flex items-center gap-2">
          <span
            aria-hidden
            data-testid={`${testId}-avatar`}
            className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-semibold text-[var(--nb-white)]"
            style={{ backgroundColor: avatarColor }}
          >
            {initials}
          </span>
          <span className="min-w-0 text-xs leading-[1.35] text-[var(--nb-mid)]">
            Shipped by{" "}
            <span className="font-semibold text-[var(--nb-ink)]">
              {shipperName ?? "a colleague"}
            </span>
            {dateLabel ? ` · ${dateLabel}` : ""}
          </span>
        </span>
      ) : null}
    </span>
  );
}

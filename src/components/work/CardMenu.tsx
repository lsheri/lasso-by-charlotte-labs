import { MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRowMenuParts } from "@/components/work/RowMenu";
import { effectiveWorkDate, formatDate, sourceLabel, type WorkItemRow } from "@/lib/work-types";

/** Plain words for how complete the text behind a card is. */
function fidelityLine(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value === "verbatim") return "Word for word";
  if (value === "transcribed") return "Written down from the original";
  if (value === "summary") return "Summary only";
  return value;
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline justify-between gap-3 text-[11.5px] leading-[17px]">
      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 truncate text-right text-foreground">{value}</span>
    </p>
  );
}

/**
 * One always-rendered control on the face of a card: what this piece of work
 * is, then everything you can do with it.
 *
 * The trigger is deliberately outside every hover-gated container. An earlier
 * shape put it inside a bar that was display:none until hover, so opening the
 * menu moved focus away, the bar hid, and the menu was positioned against a
 * zero-size anchor.
 */
export function CardMenu({
  item,
  clientLabel,
  onFluency,
  engagementId,
  onRemoved,
  children,
}: {
  item: WorkItemRow;
  clientLabel?: string | null | undefined;
  onFluency?: ((item: WorkItemRow) => void) | undefined;
  engagementId?: string | undefined;
  onRemoved?: (() => void) | undefined;
  /** The card's own actions, rendered above the shared item actions. */
  children?: React.ReactNode;
}) {
  const { items, dialogs } = useRowMenuParts({ item, onFluency, engagementId, onRemoved });
  const mapping = item.work_item_tasks?.[0]?.tasks ?? null;
  const place = mapping
    ? [mapping.engagements?.code, mapping.name].filter(Boolean).join(" · ")
    : (clientLabel ?? null);
  const fidelity = fidelityLine(item.content_fidelity);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          data-testid="card-menu-trigger"
          aria-label="Open this card's menu"
          className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="h-3.5 w-3.5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-72"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-0.5 px-2 py-1.5">
            <InfoLine label="From" value={sourceLabel(item.source)} />
            <InfoLine label="Date" value={formatDate(effectiveWorkDate(item))} />
            {place ? <InfoLine label="Filed" value={place} /> : null}
            {fidelity ? <InfoLine label="Text" value={fidelity} /> : null}
          </div>
          <DropdownMenuSeparator />
          {children ? (
            <>
              <div className="flex flex-col items-start gap-1.5 px-2 py-1.5">{children}</div>
              <DropdownMenuSeparator />
            </>
          ) : null}
          {items}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </>
  );
}

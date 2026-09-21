import { useVendorVisible } from "@/hooks/use-vendor-display";
import { vendorLabel } from "@/lib/conversation-shared";
import { cameOutOfLine, isTranscriptPiece } from "@/lib/work-standalone";
import type { WorkItemRow } from "@/lib/work-types";

type Item = Pick<WorkItemRow, "type"> & {
  source_meta?: WorkItemRow["source_meta"];
  source_vendor?: WorkItemRow["source_vendor"];
  orig_conversation_id?: WorkItemRow["orig_conversation_id"];
  ungrouped_at?: WorkItemRow["ungrouped_at"];
};

/**
 * The model's name, in words, on a small chip.
 *
 * Deliberately NOT a redrawn logo. A mark drawn from memory is subtly wrong,
 * it gets worse the larger it renders, and it approximates somebody else's
 * trademark. Real marks are image assets, and when they exist they can sit
 * behind this same component without anything else moving.
 */
export function VendorChip({ vendor, className = "" }: { vendor: string | null | undefined; className?: string }) {
  const visible = useVendorVisible();
  const label = visible ? vendorLabel(vendor) : "AI";
  if (!label) return null;
  return (
    <span
      data-testid="vendor-chip"
      className={`inline-flex shrink-0 items-center rounded-full border border-border bg-secondary px-1.5 py-px font-mono text-[9px] uppercase leading-none tracking-[0.06em] text-muted-foreground ${className}`}
    >
      {label}
    </span>
  );
}

/**
 * W2: a document that came out of a chat says so plainly, so a person can tell
 * it from the chat itself without opening either. Nothing new is stored to say
 * this: the vendor is in source_vendor and the kind is in source_meta.kind.
 */
export function FromChatLine({ item, className = "" }: { item: Item; className?: string }) {
  const visible = useVendorVisible();
  if (!item.orig_conversation_id || isTranscriptPiece(item)) return null;
  const line = cameOutOfLine(item, { vendorVisible: visible });
  if (!line) return null;
  return (
    <p
      data-testid="from-chat-line"
      className={`mt-1 flex items-center gap-1.5 truncate font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground ${className}`}
    >
      <VendorChip vendor={item.source_vendor ?? item.source_meta?.vendor} />
      <span className="truncate">{line}</span>
    </p>
  );
}

import { attachmentKindLabel, vendorLabel } from "@/lib/conversation-shared";
import type { WorkItemRow } from "@/lib/work-types";

/** Quiet mono chips: what the attachment is, and where it came from. */
export function ConversationChips({ item }: { item: WorkItemRow }) {
  const kind = item.source_meta?.kind ?? null;
  const vendor = item.source_vendor ?? item.source_meta?.vendor ?? null;
  if (!kind && !vendor) return null;
  return (
    <>
      {kind ? (
        <span className="mt-1 inline-block rounded-full border border-border bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          {attachmentKindLabel(kind)}
        </span>
      ) : null}
      {vendor ? (
        <span className="mt-1 inline-block rounded-full bg-accent-soft px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-accent-deep">
          {vendorLabel(vendor)}
        </span>
      ) : null}
    </>
  );
}

import { SourceMark } from "@/components/work/SourceMark";
import { attachmentKindLabel, vendorLabel } from "@/lib/conversation-shared";
import type { WorkItemRow } from "@/lib/work-types";
import { tagVariants } from "@/components/ui/tag";
import { cn } from "@/lib/utils";

/** Quiet mono chips: what the attachment is, and where it came from. */
export function ConversationChips({ item }: { item: WorkItemRow }) {
  const kind = item.source_meta?.kind ?? null;
  const vendor = item.source_vendor ?? item.source_meta?.vendor ?? null;
  if (!kind && !vendor) return null;
  return (
    <>
      {kind ? (
        <span className={cn(tagVariants(), "mt-1 inline-block")}>{attachmentKindLabel(kind)}</span>
      ) : null}
      {vendor ? (
        <span
          className={cn(tagVariants({ tone: "accent" }), "mt-1 inline-flex items-center gap-1")}
        >
          <SourceMark item={item} size={11} />
          {vendorLabel(vendor)}
        </span>
      ) : null}
    </>
  );
}

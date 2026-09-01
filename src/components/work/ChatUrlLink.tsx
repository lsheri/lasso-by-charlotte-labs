import { ExternalLink } from "lucide-react";

import { chatUrlLabel, effectiveChatUrl } from "@/lib/chat-url";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The quiet secondary way out to the source chat. The in-app transcript stays
 * the primary destination; when no URL was stored, this renders nothing at all.
 */
export function ChatUrlLink({ item }: { item: WorkItemRow | null | undefined }) {
  const url = effectiveChatUrl(
    item?.source_meta?.url,
    item?.source_vendor ?? null,
    item?.orig_conversation_id ?? null,
  );
  if (!url) return null;

  const id = item?.id;
  const note = () => {
    if (!id) return;
    void (async () => {
      try {
        const { noteSourceOpenedFn } = await import("@/lib/chat-library.functions");
        await noteSourceOpenedFn({ data: { work_item_id: id } });
      } catch {
        /* a link is a link */
      }
    })();
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={note}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {chatUrlLabel(url)}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

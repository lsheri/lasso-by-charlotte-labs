import { ExternalLink } from "lucide-react";

import { chatUrlLabel, effectiveChatUrl } from "@/lib/chat-url";
import { keptContentLabel } from "@/lib/work-open";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The quiet secondary way out to the source chat. The in-app transcript stays
 * the primary destination; when no URL was stored, this renders nothing at all.
 */
export function ChatUrlLink({
  item,
  showAbsence = false,
  turnCount,
}: {
  item: WorkItemRow | null | undefined;
  /** Cards say plainly when there is no way back, so nobody is surprised. */
  showAbsence?: boolean;
  /** Already-loaded card data; this never triggers another read. */
  turnCount?: number | null | undefined;
}) {
  const url = effectiveChatUrl(
    item?.source_meta?.url,
    item?.source_vendor ?? null,
    item?.orig_conversation_id ?? null,
  );
  if (!url) {
    if (!showAbsence) return null;
    return (
      <span className="text-xs text-muted-foreground">{keptContentLabel(item, turnCount)}</span>
    );
  }

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

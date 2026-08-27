import { ExternalLink } from "lucide-react";

import { chatUrlLabel, effectiveChatUrl } from "@/lib/chat-url";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * The quiet secondary way out to the source chat. The in-app transcript stays
 * the primary destination; when no URL was pushed, this renders nothing at all.
 */
export function ChatUrlLink({ item }: { item: WorkItemRow | null | undefined }) {
  const url = safeChatUrl(item?.source_meta?.url);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      {chatUrlLabel(url)}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  );
}

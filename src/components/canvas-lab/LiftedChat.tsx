import type { ComponentProps } from "react";

import { ChatNotesPanel, ChatReader } from "@/components/canvas-lab/chat-notes";
import { sourceVendorKey } from "@/components/work/SourceMark";
import { useVendorVisible } from "@/hooks/use-vendor-display";

/*
 * T2c-1 (one view, 9 Nov): a chat opens in the one view as its full conversation, with a Comments tab
 * beside the Trail. Same reader, same notes as the focus reader; only the frame is the one view's.
 */

export const LIFT_NOTES_COPY = { tab: "Comments" } as const;

/** The whole conversation, scrollable, where a selection anchors a highlight or a comment to one turn. */
export function LiftedChatBody(props: Omit<ComponentProps<typeof ChatReader>, "vendorKey">) {
  const vendorVisible = useVendorVisible();
  return (
    <div className="lift-chat" data-testid="lift-chat">
      <ChatReader {...props} vendorKey={vendorVisible ? sourceVendorKey(props.item) : null} />
    </div>
  );
}

/** The Comments tab: comments, highlights and the composer, exactly as the focus reader shows them. */
export function LiftedCommentsPanel(
  props: Omit<ComponentProps<typeof ChatNotesPanel>, "isThread">,
) {
  return (
    <div className="lift-notes" data-testid="lift-notes">
      <ChatNotesPanel {...props} isThread />
    </div>
  );
}

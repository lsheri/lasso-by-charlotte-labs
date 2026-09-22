import { useState } from "react";

import { WorkboardFilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
import { ChatPreviewWindow } from "@/components/work/ChatPreviewWindow";
import { sourceVendorKey } from "@/components/work/SourceMark";
import type {
  WorkboardCardPreview,
  WorkboardFilePreview as FilePreview,
} from "@/lib/workboard-card-preview.shared";
import type { WorkItemRow } from "@/lib/work-types";

/** The same content preview used by Workboard cards, without board-only chrome. */
export function WorkCardPreview({
  item,
  chatPreview,
  filePreview,
}: {
  item: WorkItemRow;
  chatPreview?: WorkboardCardPreview | undefined;
  filePreview?: FilePreview | undefined;
}) {
  const [fileFailed, setFileFailed] = useState(false);

  if (item.type === "ai_thread") {
    if (!chatPreview || chatPreview.turns.length === 0) return null;
    return (
      <ChatPreviewWindow
        testId="work-card-chat-preview"
        vendorKey={sourceVendorKey(item)}
        turns={chatPreview.turns}
      />
    );
  }

  if (!filePreview || filePreview.kind === "fallback" || fileFailed) return null;
  return (
    <div className="nb-document-preview-body mt-2 min-h-0 flex-1 overflow-hidden">
      <WorkboardFilePreview preview={filePreview} onFailure={() => setFileFailed(true)} />
    </div>
  );
}
import { useState } from "react";

import { WorkboardFilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
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
      <div data-testid="work-card-chat-preview" className="canvas-lab-chat-preview mt-2">
        {chatPreview.turns.map((turn) => (
          <div key={turn.turnNo} className="canvas-lab-preview-turn">
            <span>{turn.role}</span>
            <p>{turn.content}</p>
          </div>
        ))}
      </div>
    );
  }

  if (!filePreview || filePreview.kind === "fallback" || fileFailed) return null;
  return (
    <div className="mt-2 min-h-0 flex-1 overflow-hidden">
      <WorkboardFilePreview preview={filePreview} onFailure={() => setFileFailed(true)} />
    </div>
  );
}
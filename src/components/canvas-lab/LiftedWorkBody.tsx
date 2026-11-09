import { useState } from "react";

import { WorkboardFilePreview as FilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
import { NO_PREVIEW_COPY } from "@/design/reference/NoPreview";
import { RealPreview } from "@/design/reference/RealPreview";
import { LIFT_AUTHOR_WIDTH, liftZoom } from "@/lib/lift-view";
import { workToBoardCard } from "@/lib/work-board-card";
import type {
  WorkboardCardPreview,
  WorkboardFilePreview,
} from "@/lib/workboard-card-preview.shared";
import type { WorkItemRow } from "@/lib/work-types";

export const LIFT_BODY_COPY = {
  nothing: "Nothing to show here yet. Open the full view to read it.",
  context: "The work is still here and can be used as context.",
} as const;

/**
 * What a file shows in the lifted view. A PDF, an HTML artifact or a diagram is live, not a snapshot;
 * LIFT-6: slides and text taken from a file show too, so a deck or a sheet captured from a chat lifts
 * like any other work instead of falling back to the old reader.
 */
export function liftFilePreview(
  filePreview: WorkboardFilePreview | undefined,
): WorkboardFilePreview | undefined {
  if (!filePreview) return undefined;
  if (filePreview.kind === "pdf" && filePreview.url) return filePreview;
  if ((filePreview.kind === "html" || filePreview.kind === "mermaid") && filePreview.html)
    return filePreview;
  if (filePreview.kind === "slide" && (filePreview.pages?.length || filePreview.lines.length))
    return filePreview;
  if (filePreview.kind === "text" && filePreview.lines.some((line) => line.trim()))
    return filePreview;
  return undefined;
}

/**
 * LIFT (behind lift-v1): what a lifted piece of work shows. The same real preview the card draws, but
 * unclipped and scrollable at a readable size, and with PDFs and artifacts live (page through a PDF,
 * use an artifact). Nothing is invented: no preview and no summary says so and points to the full view.
 */
export function LiftedWorkBody({
  item,
  preview,
  filePreview,
  bodyWidth,
}: {
  item: WorkItemRow;
  preview?: WorkboardCardPreview | undefined;
  filePreview?: WorkboardFilePreview | undefined;
  bodyWidth: number;
}) {
  const [fileFailed, setFileFailed] = useState(false);
  const work = workToBoardCard(item, preview, filePreview);
  const file = fileFailed ? undefined : liftFilePreview(filePreview);
  const title = work.title || item.title;

  if (work.content) {
    return (
      <div
        className="lift-real"
        data-testid="lift-real"
        style={{ width: LIFT_AUTHOR_WIDTH, zoom: liftZoom(bodyWidth) }}
      >
        <RealPreview work={work} />
      </div>
    );
  }
  if (file) {
    const reading = file.kind === "slide" || file.kind === "text";
    return (
      <div className={reading ? "lift-file lift-file-reading" : "lift-file"} data-testid="lift-file">
        <FilePreview preview={file} title={title} focused onFailure={() => setFileFailed(true)} />
      </div>
    );
  }
  const summary = item.work_item_extracts
    ?.find((extract) => extract.summary?.trim())
    ?.summary?.trim();
  if (summary) {
    return (
      <div className="lift-summary" data-testid="lift-summary">
        {summary.split(/\n{2,}/).map((para, index) => (
          <p key={index}>{para}</p>
        ))}
      </div>
    );
  }
  // LIFT-6: the card's own no-preview words, so the view never says something the card did not.
  const reason = filePreview?.kind === "fallback" ? filePreview.reason : undefined;
  return (
    <div className="lift-nothing" data-testid="lift-nothing">
      <p>{reason ? NO_PREVIEW_COPY[reason] : LIFT_BODY_COPY.nothing}</p>
      {reason ? <p className="lift-nothing-note">{LIFT_BODY_COPY.context}</p> : null}
    </div>
  );
}

import { useState } from "react";

import { WorkboardFilePreview as FilePreview } from "@/components/canvas-lab/WorkboardFilePreview";
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
} as const;

/** A PDF, an HTML artifact or a diagram the card can draw: in the lifted view it is live, not a snapshot. */
export function liftFilePreview(
  filePreview: WorkboardFilePreview | undefined,
): WorkboardFilePreview | undefined {
  if (!filePreview) return undefined;
  if (filePreview.kind === "pdf" && filePreview.url) return filePreview;
  if ((filePreview.kind === "html" || filePreview.kind === "mermaid") && filePreview.html)
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
    return (
      <div className="lift-file" data-testid="lift-file">
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
  return (
    <p className="lift-nothing" data-testid="lift-nothing">
      {LIFT_BODY_COPY.nothing}
    </p>
  );
}

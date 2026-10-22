import { describe, expect, it } from "vitest";

import { NO_PREVIEW_COPY } from "@/design/reference/NoPreview";
import type { NoPreviewReason } from "@/lib/workboard-card-preview.shared";
import { fallbackFilePreview } from "@/lib/workboard-file-preview";
import type { WorkItemRow } from "@/lib/work-types";

const item = { id: "w1", title: "t", type: "document", source: "upload", visibility: "mapped", captured_at: "2026-10-22T00:00:00Z", content_ref: null, work_item_tasks: [] } as WorkItemRow;
const ALL: NoPreviewReason[] = ["not_previewable", "no_text", "unreadable", "refused"];

describe("FACE-2 no-preview reason", () => {
  it("defaults the fallback reason to no_text", () => {
    expect(fallbackFilePreview(item).reason).toBe("no_text");
    expect(fallbackFilePreview(item, 2).reason).toBe("no_text");
  });
  it("carries the reason it is given", () => {
    for (const reason of ALL) expect(fallbackFilePreview(item, 0, reason).reason).toBe(reason);
  });
  it("has a sentence for every reason", () => {
    expect(Object.keys(NO_PREVIEW_COPY).sort()).toEqual([...ALL].sort());
    for (const reason of ALL) expect(NO_PREVIEW_COPY[reason].length).toBeGreaterThan(0);
  });
});

import { noPreviewReasonFor } from "@/components/canvas-lab/LabCard";

describe("FACE-2b pending preview is not a missing preview", () => {
  it("gives null for a previewable item whose preview has not arrived", () => {
    expect(noPreviewReasonFor({ hasPreview: false, previewable: true })).toBeNull();
  });
  it("gives the carried reason", () => {
    expect(noPreviewReasonFor({ hasPreview: true, previewable: true, reason: "refused" })).toBe("refused");
  });
  it("gives no_text for a preview with no reason", () => {
    expect(noPreviewReasonFor({ hasPreview: true, previewable: true })).toBe("no_text");
  });
  it("gives not_previewable for a non-previewable item with no preview", () => {
    expect(noPreviewReasonFor({ hasPreview: false, previewable: false })).toBe("not_previewable");
  });
});

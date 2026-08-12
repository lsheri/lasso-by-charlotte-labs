import { createFileRoute } from "@tanstack/react-router";

import { Suggested, SuggestDot, SuggestLegend } from "@/components/common/Suggested";
import { SuggestionChip } from "@/components/work/SuggestionChip";
import { WorkRow } from "@/components/work/WorkRow";
import type { WorkItemRow } from "@/lib/work-types";

const LONG =
  "2026-04-18 Acme Holdings Transformation Programme Steering Committee Meeting Recording Transcript FINAL v3 (2026-04-18 14:30 GMT-4).md";

const item = {
  id: "1",
  title: LONG,
  type: "call",
  source: "googledrive",
  source_vendor: "googledrive",
  visibility: "unmapped",
  content_fidelity: "transcribed",
  created_at: new Date().toISOString(),
  work_date: null,
  meta: { web_view_link: "https://drive.google.com/x" },
  work_item_tasks: [],
} as unknown as WorkItemRow;

export const Route = createFileRoute("/qa-layout")({
  component: () => (
    <div className="space-y-4 bg-background p-3">
      <SuggestLegend />
      <WorkRow
        item={item}
        actions={<span className="text-xs text-muted-foreground">Map</span>}
        footer={
          <SuggestionChip
            label="ACME-2 · Discovery interviews"
            reason="title matches the engagement code"
            pending={false}
            onAccept={() => {}}
            onDismiss={() => {}}
          />
        }
      />
      <Suggested className="flex flex-wrap items-center gap-3">
        <SuggestDot />
        <p className="min-w-0 flex-1 text-sm text-foreground">
          4 new files in “Meet Recordings” since you last looked. Nothing was imported.
        </p>
      </Suggested>
    </div>
  ),
});

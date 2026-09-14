import { useMemo, useState } from "react";

import { latestDeliverable } from "@/components/engagements/WhatFedThisButton";
import { CtaInfoPopover, CtaInfoTrigger } from "@/components/engagements/CtaInfo";
import { Button } from "@/components/ui/button";
import { openJourney } from "@/lib/journey-state";
import { WORK_ARTIFACT_INFO, WORK_ARTIFACT_TITLE } from "@/lib/work-artifact-shared";
import type { WorkItemRow } from "@/lib/work-types";

export const JOURNEY_EMPTY_HINT = "Add a finished deliverable to see how it grew.";

/**
 * Journey and shipping used to hide in the peek footer. They belong beside
 * "What fed this" on the canvas, anchored on the very same latest deliverable
 * that button already chooses, so the three read as one cluster.
 *
 * PASS 164 — Shipping and Work Artifact moved to the Share tab. This component
 * keeps the existing Journey handler available there and in any future caller.
 */
export function CanvasDeliverableActions({
  items,
  engagementId, profile,
}: {
  items: WorkItemRow[];
  engagementId: string;
  profile: { id: string; role: string } | null | undefined;
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const anchor = useMemo(() => latestDeliverable(items), [items]);
  const ready = anchor !== null;

  return (
    <div className="relative inline-flex">
      <Button
        type="button"
        variant="secondary"
        disabled={!ready}
        title={ready ? undefined : JOURNEY_EMPTY_HINT}
        onClick={() => {
          if (!anchor) return;
          openJourney({ anchorId: anchor.id, anchorTitle: anchor.title, engagementId });
        }}
        className="rounded-full pr-[42px]"
      >
        <SpiderDrawing size={24} />
        <span className="mr-2.5">{WORK_ARTIFACT_TITLE}</span>
      </Button>
      <CtaInfoTrigger open={infoOpen} onToggle={() => setInfoOpen((prev) => !prev)} />
      {infoOpen ? <CtaInfoPopover>{WORK_ARTIFACT_INFO}</CtaInfoPopover> : null}
    </div>
  );
}

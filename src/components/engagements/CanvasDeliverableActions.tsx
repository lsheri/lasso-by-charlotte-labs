import { useMemo, useState } from "react";

import { latestDeliverable } from "@/components/engagements/WhatFedThisButton";
import { StitchLoop } from "@/components/notebook/marks";
import { ShipToFirmDialog } from "@/components/work/ShipToFirmDialog";
import { openJourney } from "@/lib/journey-state";
import { SHIP_ACTION_LABEL } from "@/lib/shipped-work-shared";
import { ownsWorkItem } from "@/lib/work-ownership";
import type { WorkItemRow } from "@/lib/work-types";

export const JOURNEY_EMPTY_HINT = "Add a finished deliverable to see how it grew.";
export const SHIP_EMPTY_HINT = "Add a finished deliverable to ship it.";

const QUIET_PILL =
  "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/50";
const QUIET_PILL_OFF =
  "inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-muted-foreground opacity-60";

/**
 * Journey and shipping used to hide in the peek footer. They belong beside
 * "What fed this" on the canvas, anchored on the very same latest deliverable
 * that button already chooses, so the three read as one cluster.
 */
export function CanvasDeliverableActions({
  items,
  engagementId,
  profile,
}: {
  items: WorkItemRow[];
  engagementId: string;
  profile: { id: string; role: string } | null | undefined;
}) {
  const [shipOpen, setShipOpen] = useState(false);
  const anchor = useMemo(() => latestDeliverable(items), [items]);
  const ready = anchor !== null;
  const canShip = Boolean(anchor) && ownsWorkItem(profile, anchor ?? {});

  return (
    <>
      <button
        type="button"
        disabled={!ready}
        title={ready ? undefined : JOURNEY_EMPTY_HINT}
        onClick={() => {
          if (!anchor) return;
          openJourney({ anchorId: anchor.id, anchorTitle: anchor.title, engagementId });
        }}
        className={ready ? QUIET_PILL : QUIET_PILL_OFF}
      >
        <StitchLoop size={16} aria-hidden />
        Journey
      </button>

      {profile && profile.role !== "coach" && (canShip || !ready) ? (
        <button
          type="button"
          disabled={!canShip}
          title={canShip ? undefined : SHIP_EMPTY_HINT}
          onClick={() => setShipOpen(true)}
          className={canShip ? QUIET_PILL : QUIET_PILL_OFF}
        >
          {SHIP_ACTION_LABEL}
        </button>
      ) : null}

      {anchor && canShip ? (
        <ShipToFirmDialog
          workItemId={anchor.id}
          title={anchor.title}
          engagementId={engagementId}
          open={shipOpen}
          onOpenChange={setShipOpen}
        />
      ) : null}
    </>
  );
}

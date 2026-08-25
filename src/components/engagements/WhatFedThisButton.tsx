import { useMemo, useState } from "react";

import { CtaInfoPopover, CtaInfoTrigger } from "@/components/engagements/CtaInfo";
import { PencilHatch } from "@/components/notebook/marks";
import { openProvenanceAudit } from "@/components/provenance/audit-state";
import {
  AnalysisConfirm,
  type AnalysisConfirmRequest,
} from "@/components/reflect/AnalysisConfirm";
import { analysisPreset } from "@/lib/analysis-presets";
import { isDeliverableType } from "@/lib/lineage-shared";
import { effectiveWorkDate, type WorkItemRow } from "@/lib/work-types";

export const WHAT_FED_THIS_EMPTY_HINT =
  "Add a finished deliverable to trace where its facts came from.";

export const WHAT_FED_THIS_INFO =
  "Circle any fact on your finished work and Lasso finds where it came from in this engagement's record.";

/** A fuller spider web mark, larger and more recognisable, drawn in graphite. */
export function WebMark({ size = 18 }: { size?: number } = {}) {
  return (
    <svg
      className="nb-web-mark shrink-0"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Radial spokes */}
      <path d="M12 12 12 1M12 12 22 5M12 12 23 12M12 12 22 19M12 12 12 23M12 12 2 19M12 12 1 12M12 12 2 5" />
      {/* Inner web ring */}
      <path d="M12 7.5c2.5 0 4.5 2 4.5 4.5M12 7.5c-2.5 0-4.5 2-4.5 4.5M16.5 12c0 2.5-2 4.5-4.5 4.5M7.5 12c0 2.5 2 4.5 4.5 4.5" />
      {/* Middle web ring */}
      <path d="M12 4.5c4.1 0 7.5 3.4 7.5 7.5M12 4.5c-4.1 0-7.5 3.4-7.5 7.5M19.5 12c0 4.1-3.4 7.5-7.5 7.5M4.5 12c0 4.1 3.4 7.5 7.5 7.5" />
      {/* Outer web ring */}
      <path d="M12 2c5.5 0 10 4.5 10 10M12 2C6.5 2 2 6.5 2 12M22 12c0 5.5-4.5 10-10 10M2 12c0 5.5 4.5 10 10 10" />
      {/* Small connecting ties */}
      <path d="M6.5 4.5 8 6M17.5 4.5 16 6M20 12h-2M4 12h2M6.5 19.5 8 18M17.5 19.5 16 18" />
    </svg>
  );
}

/** The most recent finished deliverable mapped into this engagement, if any. */

export function latestDeliverable(items: WorkItemRow[]): WorkItemRow | null {
  const deliverables = items.filter((item) => isDeliverableType(item.type));
  if (deliverables.length === 0) return null;
  return [...deliverables].sort((a, b) =>
    effectiveWorkDate(b).localeCompare(effectiveWorkDate(a)),
  )[0]!;
}

/**
 * The canvas entry point into the provenance audit. It is quiet until this
 * engagement holds something finished, and it runs the same what_fed_this
 * confirm the analysis chips run: the confirm chooses the anchor, and the
 * audit takes over from there.
 */
export function WhatFedThisButton({
  items,
  orgId,
  profileId,
}: {
  items: WorkItemRow[];
  orgId?: string | undefined;
  profileId?: string | undefined;
}) {
  const [confirming, setConfirming] = useState<AnalysisConfirmRequest | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const anchor = useMemo(() => latestDeliverable(items), [items]);
  const preset = analysisPreset("what_fed_this");
  if (!preset) return null;
  const ready = anchor !== null;

  return (
    <div className="relative flex items-center gap-1">
      <AnalysisConfirm
        request={confirming}
        orgId={orgId}
        profileId={profileId}
        onCancel={() => setConfirming(null)}
        onConfirm={(anchorItemId) => {
          const pending = confirming;
          setConfirming(null);
          const id = anchorItemId ?? (pending?.target.kind === "item" ? pending.target.id : null);
          if (!id) return;
          openProvenanceAudit({
            anchorId: id,
            anchorTitle: pending?.target.kind === "item" ? pending.target.title : "",
          });
        }}
      />
      <button
        type="button"
        disabled={!ready}
        title={ready ? undefined : WHAT_FED_THIS_EMPTY_HINT}
        onClick={() => {
          if (!anchor) return;
          setConfirming({
            preset,
            target: {
              kind: "item",
              id: anchor.id,
              title: anchor.title,
              scope: "deliverable",
            },
          });
        }}
        className="nb-pencil-cta pr-[42px]"
      >
        <PencilHatch seed="cta-web" />
        <WebMark size={18} />
        <span className="ml-2 mr-2.5">What fed this</span>
      </button>
      <CtaInfoTrigger open={infoOpen} onToggle={() => setInfoOpen((prev) => !prev)} />

      {infoOpen ? <CtaInfoPopover>{WHAT_FED_THIS_INFO}</CtaInfoPopover> : null}
    </div>
  );
}

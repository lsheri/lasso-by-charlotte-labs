import { Info } from "lucide-react";
import { useMemo, useState } from "react";

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
        className={
          ready
            ? "nb-web-cta inline-flex items-center gap-2 rounded-full border border-accent px-5 py-2.5 text-sm font-medium text-foreground"
            : "nb-web-cta inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm text-muted-foreground opacity-60"
        }
      >
        <WebMark />
        What fed this
      </button>

      <button
        type="button"
        aria-label="How this works"
        title="How this works"
        aria-expanded={infoOpen}
        onClick={() => setInfoOpen((prev) => !prev)}
        className="inline-flex items-center text-muted-foreground transition-colors hover:text-foreground"
      >
        <Info className="h-3 w-3" aria-hidden />
      </button>
      {infoOpen ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-[var(--radius-md)] border border-border bg-card px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-sm">
          {WHAT_FED_THIS_INFO}
        </div>
      ) : null}
    </div>
  );
}

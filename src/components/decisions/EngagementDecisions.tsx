import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { DecisionCard } from "@/components/decisions/DecisionCard";
import { SuggestDot } from "@/components/common/Suggested";
import { Button } from "@/components/ui/button";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { useDecisionActions } from "@/hooks/use-decision-actions";
import { useEngagementSlice } from "@/hooks/use-engagement-page";
import { srcsOf, useEngagementDecisions, type DecisionRow } from "@/hooks/use-decisions";
import { draftEngagementDecisions } from "@/lib/decisions.functions";

/**
 * The decision record, on the page that holds the context. Drafts wear the
 * suggestion treatment because a drafted decision is exactly "Lasso suggested
 * it, a person decides".
 */
export function EngagementDecisions({
  engagementId,
  profileId,
  canEdit,
}: {
  engagementId: string;
  profileId: string | undefined;
  canEdit: boolean;
}) {
  const { data: decisions, isLoading } = useEngagementDecisions(engagementId);
  const actions = useDecisionActions();
  const queryClient = useQueryClient();
  const run = useServerFn(draftEngagementDecisions);
  const [busy, setBusy] = useState(false);
  const [sourceItem, setSourceItem] = useState<string | null>(null);

  // Confirmed sequence order: a decision sits where its earliest cited item
  // sits in the workflow. Everything unsequenced falls to the end, oldest first.
  const { data: steps } = useEngagementSlice<Record<string, number>>(
    engagementId,
    ["engagement-step-order", engagementId],
    (payload) => payload.stepOrder,
  );

  function rankOf(decision: DecisionRow): number {
    const ranks = srcsOf(decision)
      .map((s) => steps?.[s.work_item_id])
      .filter((n): n is number => typeof n === "number");
    return ranks.length > 0 ? Math.min(...ranks) : Number.MAX_SAFE_INTEGER;
  }

  const rows = [...(decisions ?? [])].sort((a, b) => {
    const diff = rankOf(a) - rankOf(b);
    if (diff !== 0) return diff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  const draftCount = rows.filter((d) => d.status === "draft").length;

  async function findDecisions() {
    setBusy(true);
    try {
      const result = await run({ data: { engagement_id: engagementId, profile_id: profileId } });
      await queryClient.invalidateQueries({ queryKey: ["decisions"] });
      toast(
        result.scanned === 0
          ? "Nothing mapped into this engagement yet, so there is nothing to read."
          : result.drafted > 0
            ? `${result.drafted} decision${result.drafted === 1 ? "" : "s"} drafted for you to confirm or correct.`
            : "Lasso did not find a consequential decision in this engagement yet.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't look for decisions");
    } finally {
      setBusy(false);
    }
  }

  const findButton = canEdit ? (
    <Button type="button" size="lg" disabled={busy} onClick={() => void findDecisions()}>
      <Sparkle className="mr-2 h-4 w-4" aria-hidden />
      {busy ? "Reading this engagement…" : "Find decisions in this engagement"}
    </Button>
  ) : null;

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="micro-label">Decisions</h2>
        {rows.length > 0 ? (
          <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            {draftCount > 0 ? <SuggestDot /> : null}
            {rows.length - draftCount} confirmed · {draftCount} awaiting you
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">Loading decisions…</p>
      ) : rows.length === 0 ? (
        <div
          className="mt-3 rounded-[var(--radius)] border border-dashed border-l-[3px] px-6 py-8 text-center"
          style={{
            background: "var(--suggest-wash)",
            borderLeftStyle: "solid",
            borderLeftColor: "var(--suggest-edge)",
          }}
        >
          <p className="mx-auto max-w-md text-sm text-foreground">
            No decisions recorded yet. Lasso can look across this engagement and propose what you
            decided, for you to confirm or correct.
          </p>
          {findButton ? <div className="mt-5">{findButton}</div> : null}
        </div>
      ) : (
        <>
          {findButton ? <div className="mt-3">{findButton}</div> : null}
          <div className="mt-4 space-y-4">
            {rows.map((decision) => (
              <DecisionCard
                key={decision.id}
                decision={decision}
                onOpenSource={setSourceItem}
                onConfirm={() => actions.confirm(decision)}
                onSaveEdit={(fields) => actions.saveEdit(decision, fields)}
                onDiscard={() => actions.discard(decision)}
              />
            ))}
          </div>
        </>
      )}

      {actions.error ? <p className="mt-3 text-sm text-destructive">{actions.error}</p> : null}

      <ThreadViewerById workItemId={sourceItem} onClose={() => setSourceItem(null)} />
    </section>
  );
}

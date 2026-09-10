import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AddDecisionDialog } from "@/components/decisions/AddDecisionDialog";
import { DecisionLogRow } from "@/components/decisions/DecisionLogRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { ToneCard } from "@/components/notebook/ToneCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { useDecisions, type DecisionRow } from "@/hooks/use-decisions";
import type { Database } from "@/integrations/supabase/types";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";

const FILTERS = [
  { id: "all", label: "Everything" },
  { id: "draft", label: "Awaiting your review" },
  { id: "no-why", label: "Needs reasoning" },
] as const;

type FilterId = (typeof FILTERS)[number]["id"];

export function DecisionsPage() {
  const { data: profile } = useProfile();
  const { data: decisions, isLoading, error } = useDecisions();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [sourceItem, setSourceItem] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [reasoningFor, setReasoningFor] = useState<DecisionRow | null>(null);
  const [reasoningText, setReasoningText] = useState("");

  const rows = decisions ?? [];
  const drafts = rows.filter((d) => d.status === "draft");
  const withReasoning = rows.filter((d) => Boolean(d.why?.trim())).length;
  const visible = rows.filter((d) => {
    if (filter === "draft") return d.status === "draft";
    if (filter === "no-why") return !d.why?.trim();
    return true;
  });

  const metaLine = `${rows.length} ${rows.length === 1 ? "decision" : "decisions"} · ${withReasoning} carry the reasoning`;

  async function update(
    decision: DecisionRow,
    patch: Database["public"]["Tables"]["decisions"]["Update"],
    status: string,
    edited: boolean,
  ) {
    setActionError(null);
    const { error: updateError } = await supabase
      .from("decisions")
      .update(patch)
      .eq("id", decision.id);
    if (updateError) return setActionError(updateError.message);
    if (profile) {
      logEvent("decision.resolved", profile.org_id, { status, edited });
      if (status === "confirmed") logEvent("decision.confirmed", profile.org_id, { edited });
      logV2("decision.resolved", { status: status as never, edited }, { profileId: profile.id });
      if (status === "confirmed")
        logV2("decision.confirmed", { edited, evidence_count: 0 }, { profileId: profile.id });
      if (status === "discarded") logV2("decision.discarded", { edited }, { profileId: profile.id });
    }
    await queryClient.invalidateQueries({ queryKey: ["decisions"] });
  }

  function startReasoning(decision: DecisionRow) {
    setReasoningFor(decision);
    setReasoningText(decision.why ?? "");
  }

  function confirmDecision(decision: DecisionRow) {
    void update(
      decision,
      { status: "confirmed", resolved_at: new Date().toISOString() },
      "confirmed",
      false,
    );
  }

  function discardDecision(decision: DecisionRow) {
    void update(
      decision,
      { status: "discarded", resolved_at: new Date().toISOString() },
      "discarded",
      false,
    );
  }

  function saveReasoning() {
    if (!reasoningFor) return;
    const decision = reasoningFor;
    setReasoningFor(null);
    void update(
      decision,
      { why: reasoningText.trim(), status: "confirmed", author: "human", resolved_at: new Date().toISOString() },
      "confirmed",
      true,
    );
  }

  return (
    <div>
      {/* Figma 30:1419 hangs "Log a decision" off the title's baseline as a
          quiet outline control, not a filled secondary beside the header. */}
      <PageHeader
        title="Decision"
        italicWord="log"
        subtitle={metaLine}
        action={
          <AddDecisionDialog
            trigger={
              <Button type="button" variant="outline">
                Log a decision
              </Button>
            }
          />
        }
      />

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={
              filter === f.id
                ? "rounded-full border border-graphite bg-nb-white px-3 py-1 text-[11.5px] font-medium text-foreground"
                : "rounded-full border border-[var(--nb-pencil)] px-3 py-1 text-[11.5px] text-muted-foreground transition-colors hover:border-foreground"
            }
          >
            {f.label}
          </button>
        ))}
      </div>

      {error ? <p className="mb-6 text-sm text-destructive">{(error as Error).message}</p> : null}
      {actionError ? <p className="mb-6 text-sm text-destructive">{actionError}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your decisions…</p>
      ) : rows.length === 0 ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <p className="py-5 text-sm text-muted-foreground">
            Nothing logged yet. A decision lands here the moment you make a call.
          </p>
          <DecisionRail rows={rows.length} withReasoning={withReasoning} drafts={drafts.length} />
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="divide-y divide-border">
            {visible.map((d) => (
              <div key={d.id}>
                <DecisionLogRow
                  decision={d}
                  onOpenSource={setSourceItem}
                  onAddReasoning={startReasoning}
                  onConfirm={confirmDecision}
                  onDiscard={discardDecision}
                />
                {reasoningFor?.id === d.id ? (
                  <div className="pb-5 pl-0 sm:pl-[100px]">
                    <Textarea
                      rows={3}
                      value={reasoningText}
                      onChange={(e) => setReasoningText(e.target.value)}
                      placeholder="Why was this the right call?"
                    />
                    <div className="mt-2 flex items-center gap-3">
                      <Button
                        type="button"
                        size="sm"
                        disabled={!reasoningText.trim()}
                        onClick={saveReasoning}
                      >
                        Save the reasoning
                      </Button>
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => setReasoningFor(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
            {visible.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">Nothing in this view.</p>
            ) : null}
          </div>

          <DecisionRail rows={rows.length} withReasoning={withReasoning} drafts={drafts.length} />
        </div>
      )}

      <ThreadViewerById workItemId={sourceItem} onClose={() => setSourceItem(null)} />
    </div>
  );
}

function DecisionRail({
  rows,
  withReasoning,
  drafts,
}: {
  rows: number;
  withReasoning: number;
  drafts: number;
}) {
  /**
   * Figma 30:1419 stacks three numbers here: "19 carry the reasoning",
   * "4 later reversed", "7 reused by someone else".
   *
   * Deliberate deviation, recorded rather than faked: the `decisions` table has
   * no reversed state and nothing counts reuse of a decision, so those two are
   * not invented. The three counts below are the ones the log can stand behind.
   */
  const stats: Array<[number, string]> = [
    [rows, "decisions logged"],
    [withReasoning, "carry the reasoning"],
    [drafts, "awaiting your review"],
  ];
  return (
    <aside className="space-y-6">
      {/* The frame's own wording. It says why the reasoning is the part worth
          keeping, rather than restating what the log is. */}
      <ToneCard
        tone="record"
        label="WHY THE LOG EXISTS"
        title="A decision without its reasoning is just a fact."
      >
        Six months from now, the reasoning is the part nobody can reconstruct. The log is not a
        record of being right, it is a record of what you knew.
      </ToneCard>

      <div>
        {stats.map(([value, caption]) => (
          <div key={caption} className="border-b border-border py-3">
            {/* Instrument Serif at display size, the way the frame sets a
                headline number: light and roomy, never bold. */}
            <div className="font-serif text-[30px] leading-[36px] tabular-nums text-foreground">
              {value}
            </div>
            <div className="mt-0.5 text-[11.5px] text-muted-foreground">{caption}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

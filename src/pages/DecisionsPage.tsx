import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AddDecisionDialog } from "@/components/decisions/AddDecisionDialog";
import { DecisionLogRow } from "@/components/decisions/DecisionLogRow";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import type { ThreadFocus } from "@/components/peek/ThreadBody";
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

export type DecisionFilter = (typeof FILTERS)[number]["id"];
export type DecisionBand = { label: "this week" | "earlier"; rows: DecisionRow[] };

/** How many entries the timeline shows before the quiet reveal control. */
export const DECISION_PAGE_SIZE = 25;


export function filterDecisions(rows: DecisionRow[], filter: DecisionFilter): DecisionRow[] {
  if (filter === "draft") return rows.filter((row) => row.status === "draft");
  if (filter === "no-why") return rows.filter((row) => row.status === "confirmed" && !row.why?.trim());
  return rows;
}

export function groupDecisions(rows: DecisionRow[], now = Date.now()): DecisionBand[] {
  const week = 7 * 24 * 60 * 60 * 1000;
  const recent = rows.filter((row) => now - new Date(row.created_at).getTime() <= week);
  const earlier = rows.filter((row) => now - new Date(row.created_at).getTime() > week);
  return [
    ...(recent.length ? [{ label: "this week" as const, rows: recent }] : []),
    ...(earlier.length ? [{ label: "earlier" as const, rows: earlier }] : []),
  ];
}

export function decisionCounts(rows: DecisionRow[]) {
  const confirmed = rows.filter((row) => row.status === "confirmed");
  return {
    confirmed: confirmed.length,
    withReasoning: confirmed.filter((row) => Boolean(row.why?.trim())).length,
    awaiting: rows.filter((row) => row.status === "draft").length,
  };
}

function entryDate(value: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(value))
    .toUpperCase();
}

export function DecisionsPage() {
  const { data: profile } = useProfile();
  const { data: decisions, isLoading, error } = useDecisions();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [sourceItem, setSourceItem] = useState<string | null>(null);
  const [sourceFocus, setSourceFocus] = useState<ThreadFocus | undefined>();
  const [filter, setFilter] = useState<DecisionFilter>("all");
  const [shown, setShown] = useState(DECISION_PAGE_SIZE);

  const rows = decisions ?? [];
  // Counts and filters always read the whole set, never the visible slice.
  const visible = filterDecisions(rows, filter);
  const paged = visible.slice(0, shown);
  const hiddenCount = visible.length - paged.length;
  const groups = groupDecisions(paged);
  const counts = decisionCounts(rows);


  async function update(
    decision: DecisionRow,
    patch: Database["public"]["Tables"]["decisions"]["Update"],
    status: string,
    edited: boolean,
  ) {
    setActionError(null);
    const { error: updateError } = await supabase.from("decisions").update(patch).eq("id", decision.id);
    if (updateError) return setActionError(updateError.message);
    if (profile) {
      logEvent("decision.resolved", profile.org_id, { status, edited });
      if (status === "confirmed") logEvent("decision.confirmed", profile.org_id, { edited, surface: "log" });
      logV2("decision.resolved", { status: status as never, edited }, { profileId: profile.id });
      if (status === "confirmed")
        logV2("decision.confirmed", { edited, evidence_count: 0, surface: "log" }, { profileId: profile.id });
      if (status === "discarded") logV2("decision.discarded", { edited, surface: "log" }, { profileId: profile.id });
      if (edited) logV2("decision.edited", { edited, surface: "log" }, { profileId: profile.id });
    }
    await queryClient.invalidateQueries({ queryKey: ["decisions"] });
  }

  function saveReasoning(decision: DecisionRow, reasoning: string) {
    void update(
      decision,
      { why: reasoning.trim(), status: "confirmed", author: "human", resolved_at: new Date().toISOString() },
      "confirmed",
      true,
    );
  }

  function discardDecision(decision: DecisionRow) {
    void update(decision, { status: "discarded", resolved_at: new Date().toISOString() }, "discarded", false);
  }

  return (
    <div>
      <PageHeader
        title="Your"
        italicWord="decisions"
        subtitle="The decisions you made along the way, in the order you made them, with the reasoning you kept."
      />

      <div className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" aria-label="Decision filters">
          {FILTERS.map((item) => (
            <Button
              key={item.id}
              type="button"
              size="sm"
              variant={filter === item.id ? "secondary" : "outline"}
              aria-pressed={filter === item.id}
              onClick={() => { setFilter(item.id); setShown(DECISION_PAGE_SIZE); }}
              className="rounded-full text-[11.5px]"
            >
              {item.label}
            </Button>
          ))}
        </div>
        <AddDecisionDialog trigger={<Button type="button" variant="outline">Log a decision</Button>} />
      </div>

      {error ? <p className="mb-6 text-sm text-destructive">{(error as Error).message}</p> : null}
      {actionError ? <p className="mb-6 text-sm text-destructive">{actionError}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your decisions…</p>
      ) : (
        <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_210px]">
          <section aria-label="Decision timeline">
            {rows.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">Nothing logged yet. A decision lands here the moment you make one.</p>
            ) : visible.length === 0 ? (
              <p className="py-5 text-sm text-muted-foreground">Nothing in this view.</p>
            ) : (
              <div className="relative">
                <div className="absolute bottom-0 left-[116px] top-0 w-px bg-border" aria-hidden />
                {groups.map((group) => (
                  <div key={group.label} className="relative grid grid-cols-[92px_24px_minmax(0,1fr)]">
                    <h2 className="pt-1 text-right font-hand text-[16px] text-muted-foreground">{group.label}</h2>
                    <div />
                    <div>
                      {group.rows.map((decision) => (
                        <div key={decision.id} className="relative">
                          <span
                            className={decision.status === "confirmed" ? "absolute -left-[18px] top-2 h-2.5 w-2.5 rounded-full bg-green" : "absolute -left-[18px] top-2 h-2.5 w-2.5 rounded-full border-[1.4px] border-green bg-background"}
                            aria-hidden
                          />
                          <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{entryDate(decision.created_at)}</p>
                          <DecisionLogRow
                            decision={decision}
                            onOpenSource={(id, focus) => { setSourceItem(id); setSourceFocus(focus); }}
                            onSaveReasoning={saveReasoning}
                            onDiscard={discardDecision}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {hiddenCount > 0 ? (
                  <div className="grid grid-cols-[92px_24px_minmax(0,1fr)] pt-4">
                    <div />
                    <div />
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShown((count) => count + DECISION_PAGE_SIZE)}
                        className="font-hand text-[16px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
                      >
                        show earlier decisions
                      </button>
                      <span className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                        {hiddenCount} earlier
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            )}

          </section>
          <DecisionRail counts={counts} />
        </div>
      )}

      <ThreadViewerById workItemId={sourceItem} focus={sourceFocus} onClose={() => { setSourceItem(null); setSourceFocus(undefined); }} />
    </div>
  );
}

function DecisionRail({ counts }: { counts: ReturnType<typeof decisionCounts> }) {
  const stats: Array<[number, string]> = [
    [counts.confirmed, "decisions logged"],
    [counts.withReasoning, "carry the reasoning"],
    [counts.awaiting, "awaiting your review"],
  ];
  return (
    <aside className="space-y-7">
      <div>
        {stats.map(([value, caption]) => (
          <div key={caption} className="border-b border-border py-3 first:pt-0">
            <div className="font-serif text-[30px] leading-[34px] tabular-nums text-foreground">{value}</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">{caption}</div>
          </div>
        ))}
      </div>
      <div className="rounded-[var(--radius-md)] border border-border bg-card p-4">
        <h2 className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">Why the log exists</h2>
        <p className="mt-3 text-[13px] leading-[19px] text-foreground">
          A decision without its reasoning is just a fact. Six months from now, the reasoning is the part nobody can reconstruct. The log is not a record of being right, it is a record of what you knew.
        </p>
      </div>
    </aside>
  );
}
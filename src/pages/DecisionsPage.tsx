import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { AddDecisionDialog } from "@/components/decisions/AddDecisionDialog";
import { DecisionCard } from "@/components/decisions/DecisionCard";
import { Button } from "@/components/ui/button";
import { ThreadViewerById } from "@/components/work/ThreadViewerById";
import { useDecisions, type DecisionRow } from "@/hooks/use-decisions";
import type { Database } from "@/integrations/supabase/types";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";

export function DecisionsPage() {
  const { data: profile } = useProfile();
  const { data: decisions, isLoading, error } = useDecisions();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [sourceItem, setSourceItem] = useState<string | null>(null);

  const rows = decisions ?? [];
  const drafts = rows.filter((d) => d.status === "draft");
  const confirmed = rows.filter((d) => d.status === "confirmed");

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

  return (
    <div>
      <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Decision log</h1>
          <p className="page-subtitle">
            {confirmed.length} confirmed · {drafts.length} awaiting review
          </p>
        </div>
        <div className="text-right">
          <AddDecisionDialog trigger={<Button type="button">＋ Add a decision yourself</Button>} />
          <p className="mt-2 max-w-xs text-xs text-muted-foreground">
            The calls you made off-platform are often the ones that matter most.
          </p>
        </div>
      </header>

      {error ? <p className="mb-6 text-sm text-destructive">{(error as Error).message}</p> : null}
      {actionError ? <p className="mb-6 text-sm text-destructive">{actionError}</p> : null}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading your decisions…</p>
      ) : rows.length === 0 ? (
        <div className="mx-auto max-w-lg rounded-[var(--radius)] border border-border bg-card px-8 py-12 text-center shadow-card">
          <p className="text-sm text-foreground">
            Your consequential calls will collect here. Draft them from any AI thread, or add one
            yourself.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {drafts.length > 0 ? (
            <section>
              <h2 className="micro-label micro-label-section">Awaiting your review</h2>
              <div className="mt-3 space-y-4">
                {drafts.map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                    onOpenSource={setSourceItem}
                    onConfirm={() =>
                      void update(
                        decision,
                        { status: "confirmed", resolved_at: new Date().toISOString() },
                        "confirmed",
                        false,
                      )
                    }
                    onSaveEdit={(fields) =>
                      void update(
                        decision,
                        {
                          ...fields,
                          status: "confirmed",
                          author: "human",
                          resolved_at: new Date().toISOString(),
                        },
                        "confirmed",
                        true,
                      )
                    }
                    onDiscard={() =>
                      void update(
                        decision,
                        { status: "discarded", resolved_at: new Date().toISOString() },
                        "discarded",
                        false,
                      )
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}

          {confirmed.length > 0 ? (
            <section>
              <h2 className="micro-label micro-label-section">Confirmed</h2>
              <div className="mt-3 space-y-4">
                {confirmed.map((decision) => (
                  <DecisionCard
                    key={decision.id}
                    decision={decision}
                    onOpenSource={setSourceItem}
                    onConfirm={() => undefined}
                    onSaveEdit={(fields) =>
                      void update(decision, { ...fields, author: "human" }, "confirmed", true)
                    }
                    onDiscard={() =>
                      void update(
                        decision,
                        { status: "discarded", resolved_at: new Date().toISOString() },
                        "discarded",
                        false,
                      )
                    }
                  />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}

      <ThreadViewerById workItemId={sourceItem} onClose={() => setSourceItem(null)} />
    </div>
  );
}

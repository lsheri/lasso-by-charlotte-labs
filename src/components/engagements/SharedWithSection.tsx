import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DrawnEllipse, useMark } from "@/components/notebook/marks";
import { supabase } from "@/integrations/supabase/client";
import { useEngagementCoaches, useShareInvalidation } from "@/hooks/use-coach-share";
import {
  bulkShareDims,
  coachResultsLine,
  removalLine,
  rosterFor,
  sharedLine,
  sharedSuccessLine,
  type OrgCoach,
  type ShareResult,
} from "@/lib/coach-share-shared";
import { logEvent } from "@/lib/telemetry";

/**
 * The roster. Every active coach in the workspace is listed by name with one
 * button: Share when they cannot see this engagement, Shared plus Remove when
 * they can. Sharing is owner driven and the two RPCs stay the only authority,
 * so this surface offers the choice and reports exactly what came back.
 */
export function SharedWithSection({
  engagementId,
  orgId,
  quickFolder = false,
  personalOrg = false,
}: {
  engagementId: string;
  orgId: string;
  /** A quick folder holds unfiled work, so it is never shareable. */
  quickFolder?: boolean;
  /** Personal workspaces say "your coaches" rather than "the workspace". */
  personalOrg?: boolean;
}) {
  const invalidateShares = useShareInvalidation();
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sharingAll, setSharingAll] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const ellipse = useMark();

  const shared = useEngagementCoaches(engagementId);

  const orgCoaches = useQuery({
    queryKey: ["org-coaches", orgId],
    staleTime: 60_000,
    queryFn: async (): Promise<OrgCoach[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .eq("org_id", orgId)
        .eq("role", "coach")
        .is("deactivated_at", null)
        .order("display_name", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const readFailed = Boolean(shared.error || orgCoaches.error);
  useEffect(() => {
    if (readFailed) toast.error("We could not load sharing for this engagement just now.");
  }, [readFailed]);

  const roster = rosterFor(orgCoaches.data ?? [], shared.data ?? [], optimistic);
  const unshared = roster.filter((row) => !row.shared);
  const sharedCount = roster.length - unshared.length;

  function clearOptimistic(id: string) {
    setOptimistic((current) => {
      const copy = { ...current };
      delete copy[id];
      return copy;
    });
  }

  /** One tap each way, shown immediately and rolled back if refused. */
  async function toggle(row: { id: string; display_name: string }, next: boolean) {
    setBusyId(row.id);
    setConfirmation(null);
    setOptimistic((current) => ({ ...current, [row.id]: next }));
    const { error } = next
      ? await supabase.rpc("share_engagement_with_coach", {
          p_engagement: engagementId,
          p_coach_profile: row.id,
        })
      : await supabase.rpc("unshare_engagement_coach", {
          p_engagement: engagementId,
          p_coach_profile: row.id,
        });
    if (error) {
      clearOptimistic(row.id);
      setConfirmation(error.message);
      toast.error(error.message);
      setBusyId(null);
      return;
    }
    logEvent("coach.engagement_shared", orgId, { action: next ? "shared" : "unshared" });
    const line = next ? sharedSuccessLine(row.display_name) : removalLine(row.display_name);
    setConfirmation(line);
    toast.success(line);
    await invalidateShares();
    setBusyId(null);
  }

  /** Sequential calls so a refusal on one coach never reads as success. */
  async function shareWithAll() {
    const targets = [...unshared];
    setSharingAll(true);
    setConfirmation(null);
    setOptimistic((current) => {
      const copy = { ...current };
      for (const row of targets) copy[row.id] = true;
      return copy;
    });
    const results: ShareResult[] = [];
    for (const coach of targets) {
      const { error } = await supabase.rpc("share_engagement_with_coach", {
        p_engagement: engagementId,
        p_coach_profile: coach.id,
      });
      results.push(
        error
          ? { id: coach.id, label: coach.display_name, ok: false, message: error.message }
          : { id: coach.id, label: coach.display_name, ok: true },
      );
    }
    setOptimistic((current) => {
      const copy = { ...current };
      for (const result of results) if (!result.ok) delete copy[result.id];
      return copy;
    });
    const done = results.filter((row) => row.ok).length;
    // One event for the whole action, count only, no names and no ids.
    if (done > 0) logEvent("coach.engagement_shared", orgId, bulkShareDims("shared", done));
    const line = coachResultsLine(results);
    setConfirmation(line);
    if (results.some((row) => !row.ok)) toast.error(line);
    else toast.success(line);
    await invalidateShares();
    setSharingAll(false);
  }

  if (quickFolder) return null;

  const heading = personalOrg ? "Your coaches" : "Shared with";
  const intro = personalOrg
    ? "A coach you share with here can see this engagement. Nothing else in your workspace is visible to them."
    : "Coaches you choose here can see this engagement. Nothing else in your workspace is visible to them.";

  return (
    <section id="shared-with" className="scroll-mt-24">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="micro-label relative">
          {heading}
          {ellipse.shown ? <DrawnEllipse key={ellipse.markKey} /> : null}
        </h2>
        {unshared.length > 1 ? (
          <button
            type="button"
            disabled={sharingAll || busyId !== null}
            onClick={() => setConfirmAll(true)}
            className="rounded-full border border-accent bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep transition-opacity disabled:opacity-50"
          >
            {sharingAll ? "Sharing…" : `Share with all ${unshared.length} coaches`}
          </button>
        ) : null}
      </div>
      <p className="mt-1.5 text-sm text-muted-foreground">{intro}</p>

      <div className="mt-3 space-y-2">
        {roster.map((coach) => {
          const line = sharedLine(coach.added_at, coach.added_by_name);
          const busy = busyId === coach.id || sharingAll;
          return (
            <div
              key={coach.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card"
            >
              <div className="min-w-0">
                <p className="text-sm text-foreground">{coach.display_name}</p>
                {coach.shared && line ? (
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {line}
                  </p>
                ) : null}
              </div>
              {coach.shared ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                    {busy ? "Saving…" : "Shared"}
                  </span>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggle(coach, false)}
                    className="rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    ellipse.fire();
                    void toggle(coach, true);
                  }}
                  className="shrink-0 rounded-full border border-accent bg-accent-soft px-4 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep transition-opacity disabled:opacity-50"
                >
                  {busy ? "Saving…" : "Share"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {roster.length === 0 && !orgCoaches.isLoading ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {personalOrg
            ? "No coaches here yet. Invite one, then share this engagement with them."
            : "No coaches in this workspace yet. Invite one, then share this engagement with them."}
        </p>
      ) : null}
      {roster.length > 0 && sharedCount === 0 && !shared.isLoading ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Not shared with anyone. This engagement is yours alone.
        </p>
      ) : null}
      {confirmation ? <p className="mt-2 text-sm text-accent-deep">{confirmation}</p> : null}

      <AlertDialog open={confirmAll} onOpenChange={setConfirmAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Share this engagement with {unshared.length} coaches?</AlertDialogTitle>
            <AlertDialogDescription>
              {unshared.map((row) => row.display_name).join(", ")} will see the work mapped into this
              engagement. Nothing else in your workspace becomes visible, and you can take it back
              from any of them at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmAll(false);
                ellipse.fire();
                void shareWithAll();
              }}
            >
              Share with them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

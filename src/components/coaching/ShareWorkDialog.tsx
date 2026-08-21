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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShareInvalidation } from "@/hooks/use-coach-share";
import { DrawnEllipse, useMark } from "@/components/notebook/marks";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_HONESTY_LINE,
  bulkShareDims,
  coachShareKey,
  fetchShareableEngagements,
  groupByClient,
  removalLine,
  shareResultsLine,
  sharedLine,
  sharedSuccessLine,
  type ShareableEngagement,
  type ShareQueryClient,
  type ShareResult,
} from "@/lib/coach-share-shared";
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { logEvent } from "@/lib/telemetry";

/**
 * Coach centred sharing. The list is built from the caller's own engagement
 * memberships, so someone who does not work on an engagement is never offered
 * it here, whatever their role in the workspace. Quick folders are left out:
 * a catch all holds unfiled work and is never shareable.
 */
export function ShareWorkDialog({
  open,
  onOpenChange,
  profileId,
  orgId,
  coach,
  viewerRole,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  profileId: string;
  orgId: string;
  coach: { id: string; display_name: string };
  viewerRole: string;
}) {
  const invalidateShares = useShareInvalidation();
  /** Shown immediately, rolled back if the call is refused. */
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const ellipse = useMark();
  const [busyGroup, setBusyGroup] = useState<string | null>(null);
  const [groupLine, setGroupLine] = useState<Record<string, string>>({});
  const [confirmGroup, setConfirmGroup] = useState<{
    key: string;
    name: string;
    engagements: ShareableEngagement[];
  } | null>(null);

  const firstName = coach.display_name.split(" ")[0] ?? coach.display_name;

  const list = useQuery({
    queryKey: coachShareKey(profileId, coach.id),
    enabled: open,
    queryFn: (): Promise<ShareableEngagement[]> =>
      fetchShareableEngagements(supabase as unknown as ShareQueryClient, {
        profileId,
        coachProfileId: coach.id,
      }),
  });

  useEffect(() => {
    if (!open) {
      setOptimistic({});
      setGroupLine({});
      setBusyGroup(null);
      setBusyId(null);
    }
  }, [open]);

  async function callRpc(
    engagement: { id: string; title: string },
    action: "shared" | "unshared",
    /** Bulk actions log one event for the whole run, so rows stay silent. */
    silent = false,
  ): Promise<ShareResult> {
    const { error } =
      action === "shared"
        ? await supabase.rpc("share_engagement_with_coach", {
            p_engagement: engagement.id,
            p_coach_profile: coach.id,
          })
        : await supabase.rpc("unshare_engagement_coach", {
            p_engagement: engagement.id,
            p_coach_profile: coach.id,
          });
    if (error)
      return { id: engagement.id, label: engagement.title, ok: false, message: error.message };
    if (!silent) logEvent("coach.engagement_shared", orgId, { action });
    return { id: engagement.id, label: engagement.title, ok: true };
  }

  async function toggleOne(row: ShareableEngagement, next: boolean) {
    setBusyId(row.id);
    setOptimistic((current) => ({ ...current, [row.id]: next }));
    const result = await callRpc(
      { id: row.id, title: engagementDisplayTitle(row) },
      next ? "shared" : "unshared",
    );
    if (!result.ok) {
      setOptimistic((current) => {
        const copy = { ...current };
        delete copy[row.id];
        return copy;
      });
      toast.error(result.message ?? "That did not save.");
    } else {
      toast.success(
        next ? sharedSuccessLine(coach.display_name) : removalLine(coach.display_name),
      );
      await invalidateShares();
    }
    setBusyId(null);
  }

  async function shareGroup(group: { key: string; engagements: ShareableEngagement[] }) {
    const targets = group.engagements.filter((row) => !isShared(row));
    setBusyGroup(group.key);
    setOptimistic((current) => {
      const copy = { ...current };
      for (const row of targets) copy[row.id] = true;
      return copy;
    });
    const results: ShareResult[] = [];
    for (const row of targets) {
      results.push(
        await callRpc({ id: row.id, title: engagementDisplayTitle(row) }, "shared", true),
      );
    }
    const done = results.filter((row) => row.ok).length;
    if (done > 0) logEvent("coach.engagement_shared", orgId, bulkShareDims("shared", done));
    setOptimistic((current) => {
      const copy = { ...current };
      for (const result of results) if (!result.ok) delete copy[result.id];
      return copy;
    });
    const line = shareResultsLine(results, coach.display_name);
    setGroupLine((current) => ({ ...current, [group.key]: line }));
    if (results.some((r) => !r.ok)) toast.error(line);
    else toast.success(line);
    await invalidateShares();
    setBusyGroup(null);
  }

  function isShared(row: ShareableEngagement): boolean {
    return optimistic[row.id] ?? row.shared;
  }

  const rows = list.data ?? [];
  const groups = groupByClient(rows);

  const listFailed = Boolean(list.error);
  useEffect(() => {
    if (listFailed) toast.error("We could not load your engagements just now.");
  }, [listFailed]);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share work with {coach.display_name}</DialogTitle>
            <DialogDescription>
              Share an engagement to let {firstName} see it. Remove to take it back. Nothing else in
              your workspace is visible to them.
            </DialogDescription>
          </DialogHeader>

          {list.isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {list.error ? (
            <p className="text-sm text-muted-foreground">
              We could not load your engagements just now. Close this and try again in a moment.
            </p>
          ) : null}

          {!list.isLoading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You are not on any engagement yet, so there is nothing to share.
            </p>
          ) : null}

          <div className="max-h-[60vh] space-y-4 overflow-y-auto pb-[env(safe-area-inset-bottom)]">
            {groups.map((group) => {
              const unshared = group.engagements.filter((row) => !isShared(row));
              const groupBusy = busyGroup === group.key;
              return (
                <div key={group.key} className="space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="micro-label relative">
                      {group.name}
                      {ellipse.shown ? <DrawnEllipse key={ellipse.markKey} /> : null}
                    </p>
                    {unshared.length > 1 ? (
                      <button
                        type="button"
                        disabled={groupBusy || busyGroup !== null}
                        onClick={() => setConfirmGroup({ ...group })}
                        className="rounded-full border border-accent bg-accent-soft px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep transition-opacity disabled:opacity-50"
                      >
                        {groupBusy ? "Sharing…" : `Share all ${unshared.length} with ${firstName}`}
                      </button>
                    ) : null}
                  </div>

                  <ul className="space-y-1.5">
                    {group.engagements.map((row) => {
                      const shared = isShared(row);
                      const line = sharedLine(row.added_at, row.added_by_name);
                      const busy = groupBusy || busyId === row.id;
                      const meta = [
                        engagementDisplayCode(row),
                        shared && row.shared ? line : null,
                      ].filter((part): part is string => Boolean(part));
                      return (
                        <li
                          key={row.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-card px-4 py-3"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block truncate text-sm text-foreground">
                              {engagementDisplayTitle(row)}
                            </span>
                            {meta.length > 0 ? (
                              <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                                {meta.join(" · ")}
                              </span>
                            ) : null}
                          </div>
                          {shared ? (
                            <div className="flex shrink-0 items-center gap-2">
                              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                                {busy ? "Saving…" : "Shared"}
                              </span>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void toggleOne(row, false)}
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
                          void toggleOne(row, true);
                        }}
                              className="shrink-0 rounded-full border border-accent bg-accent-soft px-4 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-accent-deep transition-opacity disabled:opacity-50"
                            >
                              {busy ? "Saving…" : "Share"}
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {groupLine[group.key] ? (
                    <p className="text-xs text-muted-foreground">{groupLine[group.key]}</p>
                  ) : null}
                </div>
              );
            })}
          </div>

          {viewerRole === "admin" || viewerRole === "lead" ? (
            <p className="text-xs text-muted-foreground">{ADMIN_HONESTY_LINE}</p>
          ) : null}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(confirmGroup)}
        onOpenChange={(next) => {
          if (!next) setConfirmGroup(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Share {confirmGroup?.engagements.filter((row) => !isShared(row)).length ?? 0}{" "}
              engagements with {coach.display_name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {coach.display_name} will see the work mapped into each of them. Nothing else in your
              workspace becomes visible, and you can take any of them back at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmGroup) {
                  ellipse.fire();
                  void shareGroup(confirmGroup);
                }
                setConfirmGroup(null);
              }}
            >
              Share them
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

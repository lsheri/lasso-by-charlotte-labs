import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useShareInvalidation } from "@/hooks/use-coach-share";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_HONESTY_LINE,
  coachShareKey,
  fetchShareableEngagements,
  sharedLine,
  type ShareableEngagement,
  type ShareQueryClient,
} from "@/lib/coach-share-shared";
import { engagementDisplayCode, engagementDisplayTitle } from "@/lib/clients";
import { logEvent } from "@/lib/telemetry";

/**
 * Coach centred sharing. The list is built from the caller's own engagement
 * memberships, so someone who does not work on an engagement is never offered
 * it here, whatever their role in the workspace.
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
  const [busyId, setBusyId] = useState<string | null>(null);

  const list = useQuery({
    queryKey: coachShareKey(profileId, coach.id),
    enabled: open,
    queryFn: (): Promise<ShareableEngagement[]> =>
      fetchShareableEngagements(supabase as unknown as ShareQueryClient, {
        profileId,
        coachProfileId: coach.id,
      }),
  });

  const change = useMutation({
    mutationFn: async (input: { engagementId: string; action: "shared" | "unshared" }) => {
      const { error } =
        input.action === "shared"
          ? await supabase.rpc("share_engagement_with_coach", {
              p_engagement: input.engagementId,
              p_coach_profile: coach.id,
            })
          : await supabase.rpc("unshare_engagement_coach", {
              p_engagement: input.engagementId,
              p_coach_profile: coach.id,
            });
      if (error) throw new Error(error.message);
      return input.action;
    },
    onSuccess: async (action) => {
      logEvent("coach.engagement_shared", orgId, { action });
      await invalidateShares();
      toast.success(
        action === "shared"
          ? `Shared. ${coach.display_name} can now see this engagement.`
          : `Removed. ${coach.display_name} can no longer see this engagement.`,
      );
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => setBusyId(null),
  });

  const rows = list.data ?? [];

  const listFailed = Boolean(list.error);
  useEffect(() => {
    if (listFailed) toast.error("We could not load your engagements just now.");
  }, [listFailed]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share work with {coach.display_name}</DialogTitle>
          <DialogDescription>
            Tick an engagement to let {coach.display_name.split(" ")[0] ?? coach.display_name} see
            it. Untick to take it back. Nothing else in your workspace is visible to them.
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

        <ul className="space-y-1.5">
          {rows.map((row) => {
            const line = sharedLine(row.added_at, row.added_by_name);
            const meta = [
              engagementDisplayCode(row),
              row.shared ? line : null,
              busyId === row.id && change.isPending ? "saving" : null,
            ].filter((part): part is string => Boolean(part));
            return (
              <li
                key={row.id}
                className="flex items-start gap-3 rounded-[var(--radius)] border border-border bg-card px-4 py-3"
              >
                <Checkbox
                  id={`share-${row.id}`}
                  checked={row.shared}
                  disabled={change.isPending}
                  onCheckedChange={(next) => {
                    setBusyId(row.id);
                    change.mutate({
                      engagementId: row.id,
                      action: next === true ? "shared" : "unshared",
                    });
                  }}
                  className="mt-0.5"
                />
                <label htmlFor={`share-${row.id}`} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block truncate text-sm text-foreground">
                    {engagementDisplayTitle(row)}
                  </span>
                  {meta.length > 0 ? (
                    <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {meta.join(" · ")}
                    </span>
                  ) : null}
                </label>
              </li>
            );
          })}
        </ul>

        {viewerRole === "admin" || viewerRole === "lead" ? (
          <p className="text-xs text-muted-foreground">{ADMIN_HONESTY_LINE}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useEngagementCoaches, useShareInvalidation } from "@/hooks/use-coach-share";
import { sharedLine } from "@/lib/coach-share-shared";
import { logEvent } from "@/lib/telemetry";

type CoachRow = { id: string; display_name: string };

/**
 * Sharing is owner driven and explicit. The two RPCs decide who may share, so
 * this surface only offers the choice and reflects the result.
 */
export function SharedWithSection({
  engagementId,
  orgId,
}: {
  engagementId: string;
  orgId: string;
}) {
  const invalidateShares = useShareInvalidation();
  const [picked, setPicked] = useState<string>("");
  const [confirmation, setConfirmation] = useState<string | null>(null);

  const shared = useEngagementCoaches(engagementId);

  const orgCoaches = useQuery({
    queryKey: ["org-coaches", orgId],
    queryFn: async (): Promise<CoachRow[]> => {
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

  const change = useMutation({
    mutationFn: async (input: {
      coachId: string;
      coachName: string;
      action: "shared" | "unshared";
    }) => {
      const { error } =
        input.action === "shared"
          ? await supabase.rpc("share_engagement_with_coach", {
              p_engagement: engagementId,
              p_coach_profile: input.coachId,
            })
          : await supabase.rpc("unshare_engagement_coach", {
              p_engagement: engagementId,
              p_coach_profile: input.coachId,
            });
      if (error) throw new Error(error.message);
      return input;
    },
    onSuccess: async ({ action, coachName }) => {
      logEvent("coach.engagement_shared", orgId, { action });
      setPicked("");
      setConfirmation(
        action === "shared"
          ? `Shared. ${coachName} can now see this engagement.`
          : `Removed. ${coachName} can no longer see this engagement.`,
      );
      await invalidateShares();
      toast.success(
        action === "shared"
          ? `Shared. ${coachName} can now see this engagement.`
          : "Removed. They can no longer see this engagement.",
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const current = shared.data ?? [];
  const readFailed = Boolean(shared.error || orgCoaches.error);
  useEffect(() => {
    if (readFailed) toast.error("We could not load sharing for this engagement just now.");
  }, [readFailed]);
  const currentIds = new Set(current.map((row) => row.id));
  const available = (orgCoaches.data ?? []).filter((row) => !currentIds.has(row.id));
  const pickedCoach = available.find((row) => row.id === picked);

  return (
    <section id="shared-with" className="scroll-mt-24">
      <h2 className="micro-label">Shared with</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Coaches you choose here can see this engagement. Nothing else in your workspace is visible
        to them.
      </p>

      <div className="mt-3 space-y-2">
        {current.map((coach) => (
          <div
            key={coach.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card"
          >
            <div className="min-w-0">
              <p className="text-sm text-foreground">{coach.display_name}</p>
              {sharedLine(coach.added_at, coach.added_by_name) ? (
                <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {sharedLine(coach.added_at, coach.added_by_name)}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              disabled={change.isPending}
              onClick={() =>
                change.mutate({
                  coachId: coach.id,
                  coachName: coach.display_name,
                  action: "unshared",
                })
              }
              className="rounded-full border border-border px-3 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Remove
            </button>
          </div>
        ))}
        {current.length === 0 && !shared.isLoading ? (
          <p className="text-sm text-muted-foreground">
            Not shared with anyone. This engagement is yours alone.
          </p>
        ) : null}
      </div>

      {available.length > 0 ? (
        <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
          <Select
            value={picked}
            onValueChange={(next) => {
              setConfirmation(null);
              setPicked(next);
            }}
          >
            <SelectTrigger className="w-full md:w-[240px]">
              <SelectValue placeholder="Add a coach" />
            </SelectTrigger>
            <SelectContent>
              {available.map((coach) => (
                <SelectItem key={coach.id} value={coach.id}>
                  {coach.display_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            disabled={!pickedCoach || change.isPending}
            className="w-full md:w-auto"
            onClick={() =>
              pickedCoach
                ? change.mutate({
                    coachId: pickedCoach.id,
                    coachName: pickedCoach.display_name,
                    action: "shared",
                  })
                : undefined
            }
          >
            {pickedCoach ? `Share with ${pickedCoach.display_name}` : "Share"}
          </Button>
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {orgCoaches.isLoading
            ? "Loading…"
            : current.length > 0
              ? "Every coach in this workspace already has this engagement."
              : "No coaches in this workspace yet. Invite one, then share this engagement with them."}
        </p>
      )}

      {pickedCoach && !change.isPending ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing is shared until you press Share.
        </p>
      ) : null}
      {confirmation ? <p className="mt-2 text-sm text-accent-deep">{confirmation}</p> : null}
    </section>
  );
}

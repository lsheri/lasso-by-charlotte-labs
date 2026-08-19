import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string>("");

  const shared = useQuery({
    queryKey: ["engagement-coaches", engagementId],
    queryFn: async (): Promise<CoachRow[]> => {
      const { data, error } = await supabase
        .from("engagement_members")
        .select("profile_id, member_role, profiles(id, display_name)")
        .eq("engagement_id", engagementId)
        .eq("member_role", "coach");
      if (error) throw error;
      return (data ?? [])
        .map((row) => (row as unknown as { profiles: CoachRow | null }).profiles)
        .filter((row): row is CoachRow => Boolean(row));
    },
  });

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
    mutationFn: async (input: { coachId: string; action: "shared" | "unshared" }) => {
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
      return input.action;
    },
    onSuccess: async (action) => {
      logEvent("coach.engagement_shared", orgId, { action });
      setPicked("");
      await queryClient.invalidateQueries({ queryKey: ["engagement-coaches", engagementId] });
      toast.success(
        action === "shared"
          ? "Shared. They can see this engagement now."
          : "Removed. They can no longer see this engagement.",
      );
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const current = shared.data ?? [];
  const currentIds = new Set(current.map((row) => row.id));
  const available = (orgCoaches.data ?? []).filter((row) => !currentIds.has(row.id));

  return (
    <section>
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
            <p className="text-sm text-foreground">{coach.display_name}</p>
            <button
              type="button"
              disabled={change.isPending}
              onClick={() => change.mutate({ coachId: coach.id, action: "unshared" })}
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Select value={picked} onValueChange={setPicked}>
            <SelectTrigger className="w-[240px]">
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
            size="sm"
            disabled={!picked || change.isPending}
            onClick={() => change.mutate({ coachId: picked, action: "shared" })}
          >
            Share
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
    </section>
  );
}

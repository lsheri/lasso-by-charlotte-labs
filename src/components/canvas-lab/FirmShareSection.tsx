import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { FIRM_SHARE_COPY } from "@/lib/firm-share-copy";
import { formatDate } from "@/lib/work-types";
import { profileHasFirmView } from "@/lib/workspace-capabilities";

type FirmShareState = {
  firm: string;
  orgId: string;
  /** An admin or lead of the workspace: may stop sharing a board they cannot share. */
  adminOrLead: boolean;
  on: boolean;
  since: string | null;
  byName: string | null;
  /** The owner or an editor: may turn it on or off. */
  canShare: boolean;
};

export const firmShareKey = (engagementId: string) => ["firm-share", engagementId] as const;

/**
 * Share with firm, in the board's Share dialog (Liam, 15 Nov). Company workspaces only. The owner or an editor turns
 * it on or off; an admin or lead may only turn it off. Every change goes through set_engagement_firm_share, which
 * checks the same rules and tells the firm's admins and leads.
 */
export function FirmShareSection({ engagementId, profileId, open }: { engagementId: string; profileId: string | undefined; open: boolean }) {
  const queryClient = useQueryClient();
  const [confirmOff, setConfirmOff] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const state = useQuery({
    queryKey: firmShareKey(engagementId),
    enabled: open && Boolean(profileId),
    queryFn: async (): Promise<FirmShareState | null> => {
      // The same on-demand profile read the dialog uses, so the section adds no hook the dialog does not already have.
      const { ensureProfileState } = await import("@/hooks/use-profile");
      const profile = (await ensureProfileState()).profiles.find((p) => p.id === profileId);
      if (!profile || !profileHasFirmView(profile)) return null;
      const { data, error } = await supabase
        .from("engagements")
        .select("owner_id, shared_with_firm, shared_with_firm_at, shared_with_firm_by")
        .eq("id", engagementId)
        .maybeSingle();
      if (error || !data) throw error ?? new Error("not found");
      let byName: string | null = null;
      if (data.shared_with_firm_by) {
        const { data: person } = await supabase.from("profiles").select("display_name").eq("id", data.shared_with_firm_by).maybeSingle();
        byName = data.shared_with_firm_by === profile?.id ? "you" : (person?.display_name ?? null);
      }
      const { data: editor } = await supabase.rpc("is_engagement_editor", { eng: engagementId });
      return {
        firm: profile.org_name,
        orgId: profile.org_id,
        adminOrLead: profile.role === "admin" || profile.role === "lead",
        on: data.shared_with_firm,
        since: data.shared_with_firm_at,
        byName,
        canShare: data.owner_id === profile?.id || editor === true,
      };
    },
  });

  const change = useMutation({
    mutationFn: async (next: boolean) => {
      const { error } = await supabase.rpc("set_engagement_firm_share", { p_engagement: engagementId, p_on: next });
      if (error) throw error;
      return next;
    },
    onMutate: () => setProblem(null),
    onError: () => setProblem(FIRM_SHARE_COPY.failed),
    onSuccess: async (next) => {
      // Loaded on demand, like the dialog's own event, so the dialog never pulls the server-function graph at import.
      const orgId = state.data?.orgId;
      if (orgId) {
        const byRole = state.data?.canShare ? "owner" : "admin";
        void import("@/lib/telemetry")
          .then(({ logEvent }) => logEvent("board.firm_share_changed", orgId, { to: next ? "on" : "off", by_role: byRole }))
          .catch(() => {});
      }
      await queryClient.invalidateQueries({ queryKey: firmShareKey(engagementId) });
      await queryClient.invalidateQueries({ queryKey: ["firm-live-boards"] });
    },
  });

  if (!state.data) return null;
  const { firm, adminOrLead, on, since, byName, canShare } = state.data;
  // Someone who can neither share nor stop sharing sees nothing here.
  if (!canShare && !(adminOrLead && on)) return null;

  return (
    <section className="flex flex-col gap-2" aria-label={FIRM_SHARE_COPY.heading} data-testid="firm-share-section">
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground">{FIRM_SHARE_COPY.heading}</p>
      <div className="flex items-center justify-between gap-3 rounded-md border border-border p-2">
        <span className="text-sm text-foreground">{FIRM_SHARE_COPY.share}</span>
        <Switch
          aria-label={FIRM_SHARE_COPY.share}
          checked={on}
          disabled={change.isPending || (!canShare && !on)}
          onCheckedChange={(next) => {
            if (next) change.mutate(true);
            else setConfirmOff(true);
          }}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {on && since ? FIRM_SHARE_COPY.onLine(firm, formatDate(since), byName ?? "a colleague") : FIRM_SHARE_COPY.offLine}
      </p>
      {!canShare ? <p className="text-sm text-muted-foreground">{FIRM_SHARE_COPY.adminOnlyOff}</p> : null}
      {problem ? <p className="text-sm text-foreground" role="alert">{problem}</p> : null}

      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{FIRM_SHARE_COPY.stopTitle}</AlertDialogTitle>
            <AlertDialogDescription>{FIRM_SHARE_COPY.stopBody}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => change.mutate(false)}>{FIRM_SHARE_COPY.stopConfirm}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

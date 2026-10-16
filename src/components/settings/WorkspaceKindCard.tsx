import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { useProfile } from "@/hooks/use-profile";
import { canSetWorkspaceShape } from "@/lib/role-access";
import { rpcOutcome } from "@/lib/save-guard";
import { isPartnerType } from "@/lib/workspace-capabilities";

export const WORKSPACE_KIND_COPY = {
  label: "Kind of workspace",
  individual: "Individual",
  business: "Business",
  individualDescription: "Just you. Your work, your boards, your record.",
  businessDescription:
    "Your team. Members and an admin role, and clients as the way work is filed and reported back to the firm.",
  toBusiness: "Make this a business workspace",
  toIndividual: "Make this an individual workspace",
  toIndividualConsequence:
    "Clients stay where they are and nothing is deleted. Members keep their seats until you remove them.",
  fallback: "That did not save. Try again in a moment.",
  confirmToBusinessTitle: "Make this a business workspace?",
  confirmToBusinessBody: "This turns on members, an admin role, and clients as the way work is filed.",
  confirmToBusinessAction: "Make it business",
  confirmToIndividualTitle: "Make this an individual workspace?",
  confirmToIndividualAction: "Make it individual",
  confirmCancel: "Keep it as it is",
  doneBusiness: "This is a business workspace now.",
  doneIndividual: "This is an individual workspace now.",
} as const;

/** Admin-only choice between an individual and a business workspace. Partners are provisioned, never self-serve. */
export function WorkspaceKindCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  if (!profile || !canSetWorkspaceShape(profile) || isPartnerType(profile.org_type)) return null;
  const business = profile.tier === "business";
  const next = business ? "individual" : "business";

  function open() {
    if (!profile) return;
    logEvent("org.tier_change_opened", profile.org_id, { from: profile.tier, to: next });
    setConfirming(true);
  }

  async function change() {
    if (!profile) return;
    setBusy(true);
    try {
      const result = await supabase.rpc("set_workspace_tier", { p_org: profile.org_id, p_tier: next });
      const outcome = rpcOutcome(result, "ok", WORKSPACE_KIND_COPY.fallback);
      if (!outcome.ok) {
        toast.error(outcome.message);
        return;
      }
      logEvent("org.tier_changed", profile.org_id, { from: profile.tier, to: next });
      const refreshed = queryClient.invalidateQueries({ queryKey: ["profiles"] });
      toast.success(next === "business" ? WORKSPACE_KIND_COPY.doneBusiness : WORKSPACE_KIND_COPY.doneIndividual);
      await refreshed;
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="space-y-3 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <div className="space-y-1">
          <Label className="text-sm text-foreground">{WORKSPACE_KIND_COPY.label}</Label>
          <p className="text-sm text-foreground">{business ? WORKSPACE_KIND_COPY.business : WORKSPACE_KIND_COPY.individual}</p>
          <p className="text-[13px] text-muted-foreground">
            {business ? WORKSPACE_KIND_COPY.businessDescription : WORKSPACE_KIND_COPY.individualDescription}
          </p>
          {business ? <p className="text-[13px] text-muted-foreground">{WORKSPACE_KIND_COPY.toIndividualConsequence}</p> : null}
        </div>
        <Button type="button" variant="outline" disabled={busy} onClick={open}>
          {business ? WORKSPACE_KIND_COPY.toIndividual : WORKSPACE_KIND_COPY.toBusiness}
        </Button>
      </div>
      <AlertDialog open={confirming} onOpenChange={(isOpen) => !isOpen && setConfirming(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {business ? WORKSPACE_KIND_COPY.confirmToIndividualTitle : WORKSPACE_KIND_COPY.confirmToBusinessTitle}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {business ? WORKSPACE_KIND_COPY.toIndividualConsequence : WORKSPACE_KIND_COPY.confirmToBusinessBody}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{WORKSPACE_KIND_COPY.confirmCancel}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirming(false);
                void change();
              }}
            >
              {business ? WORKSPACE_KIND_COPY.confirmToIndividualAction : WORKSPACE_KIND_COPY.confirmToBusinessAction}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

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
    "Your team. Members and an admin role, clients as the way work is filed and reported back to the firm, and the firm archive of finished work the whole team can learn from.",
  toBusiness: "Make this a business workspace",
  toIndividual: "Make this an individual workspace",
  toIndividualConsequence:
    "Clients stay where they are and nothing is deleted. Members keep their seats until you remove them.",
  fallback: "That did not save. Try again in a moment.",
} as const;

/** Admin-only choice between an individual and a business workspace. Partners are provisioned, never self-serve. */
export function WorkspaceKindCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!profile || !canSetWorkspaceShape(profile) || isPartnerType(profile.org_type)) return null;
  const business = profile.tier === "business";
  const next = business ? "individual" : "business";

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
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
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
        <Button type="button" variant="outline" disabled={busy} onClick={() => void change()}>
          {business ? WORKSPACE_KIND_COPY.toIndividual : WORKSPACE_KIND_COPY.toBusiness}
        </Button>
      </div>
    </section>
  );
}

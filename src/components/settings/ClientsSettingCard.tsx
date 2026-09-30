import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { canSetWorkspaceShape } from "@/lib/role-access";
import { rpcOutcome } from "@/lib/save-guard";
import { clientsEnabled } from "@/lib/workspace-settings";

export const CLIENTS_SETTING_COPY = {
  label: "Use clients",
  description:
    "Clients are the top level in this workspace. Only an admin or a lead can add one, and everyone can file work under them.",
  offConsequence:
    "Folders stay. Your clients are not deleted and nothing inside them moves. Firm view will stop grouping by client until you turn this back on.",
  fallback: "That did not save. Try again in a moment.",
} as const;

/** Admin-only switch for whether this workspace uses clients at all. */
export function ClientsSettingCard() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  if (!profile || !canSetWorkspaceShape(profile)) return null;
  const on = clientsEnabled(profile);

  async function change(next: boolean) {
    if (!profile) return;
    setBusy(true);
    try {
      const result = await supabase.rpc("admin_set_clients_enabled", { p_org: profile.org_id, p_enabled: next });
      const outcome = rpcOutcome(result, "ok", CLIENTS_SETTING_COPY.fallback);
      if (!outcome.ok) {
        toast.error(outcome.message);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["profiles"] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="flex items-start justify-between gap-4 rounded-[var(--radius)] border border-border bg-card px-4 py-4 shadow-card">
        <div className="space-y-1">
          <Label htmlFor="use-clients" className="text-sm text-foreground">{CLIENTS_SETTING_COPY.label}</Label>
          <p className="text-[13px] text-muted-foreground">{CLIENTS_SETTING_COPY.description}</p>
          {on ? <p className="text-[13px] text-muted-foreground">{CLIENTS_SETTING_COPY.offConsequence}</p> : null}
        </div>
        <Switch id="use-clients" checked={on} disabled={busy} onCheckedChange={(next) => void change(next)} />
      </div>
    </section>
  );
}

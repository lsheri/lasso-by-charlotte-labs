import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useProfile } from "@/hooks/use-profile";
import type { DecisionRow } from "@/hooks/use-decisions";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logEvent } from "@/lib/telemetry";

type Patch = Database["public"]["Tables"]["decisions"]["Update"];

/** Confirm, edit and discard, shared by the decision log and the engagement page. */
export function useDecisionActions() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  async function apply(decision: DecisionRow, patch: Patch, status: string, edited: boolean) {
    setError(null);
    const { error: updateError } = await supabase
      .from("decisions")
      .update(patch)
      .eq("id", decision.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    if (profile) {
      logEvent("decision.resolved", profile.org_id, { status, edited });
      if (status === "confirmed") logEvent("decision.confirmed", profile.org_id, { edited });
    }
    await queryClient.invalidateQueries({ queryKey: ["decisions"] });
  }

  const now = () => new Date().toISOString();

  return {
    error,
    confirm: (decision: DecisionRow) =>
      void apply(decision, { status: "confirmed", resolved_at: now() }, "confirmed", false),
    saveEdit: (
      decision: DecisionRow,
      fields: { situation: string; call_text: string; why: string },
    ) =>
      void apply(
        decision,
        {
          ...fields,
          status: "confirmed",
          author: "human",
          resolved_at: now(),
        },
        "confirmed",
        true,
      ),
    discard: (decision: DecisionRow) =>
      void apply(decision, { status: "discarded", resolved_at: now() }, "discarded", false),
  };
}
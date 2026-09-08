import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-profile";
import { logEvent } from "@/lib/telemetry";
import { withPortfolio, type PortfolioSection } from "@/lib/portfolio";

/**
 * Promotion only. The row keeps its place, its mapping and its visibility;
 * one flag in the meta jsonb says the person is proud of it.
 */
export function usePortfolioToggle() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();

  return async function toggle(input: {
    itemId: string;
    meta: unknown;
    on: boolean;
    section: PortfolioSection;
  }): Promise<void> {
    const { error } = await supabase
      .from("work_items")
      .update({ meta: withPortfolio(input.meta, input.on) })
      .eq("id", input.itemId);
    if (error) throw error;
    if (profile?.org_id) {
      logEvent(input.on ? "portfolio.item_added" : "portfolio.item_removed", profile.org_id, {
        source_section: input.section,
      });
    }
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
  };
}

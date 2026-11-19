import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AiCostReport, CostRangeInput } from "@/lib/ai-costs-shared";

function validate(input: CostRangeInput | undefined): CostRangeInput {
  const days = typeof input?.days === "number" ? input.days : null;
  const from = typeof input?.from === "string" ? input.from.slice(0, 10) : null;
  const to = typeof input?.to === "string" ? input.to.slice(0, 10) : null;
  return { days, from, to };
}

/**
 * 18 Nov 2026, founder AI costs: AI cost per firm, person and surface, for Charlotte Labs staff only. The gate in
 * requireCostReader runs here on the server before any read (403 for everyone else); the page hiding itself is not
 * the check. Read only: it selects ai_usage, orgs and profiles and writes nothing.
 */
export const getAiCostReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<AiCostReport> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { loadAiCostReport } = await import("./ai-costs.server");
    return loadAiCostReport(supabaseAdmin, context.userId, data);
  });

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ANALYSIS_PRESET_IDS } from "@/lib/analysis-presets";
import type { AnalysisInput, AnalysisRunResult } from "@/lib/analysis-run.server";

export type { AnalysisRunResult } from "@/lib/analysis-run.server";

/** The same shape the streaming route validates, kept in one place. */
export function validateAnalysisInput(input: AnalysisInput): AnalysisInput {
  if (!(ANALYSIS_PRESET_IDS as readonly string[]).includes(input.preset_id)) {
    throw new Error("Unknown analysis.");
  }
  if (!input.work_item_id && !input.engagement_id) throw new Error("Nothing to analyse.");
  // A check id is only meaningful for the firm checks preset, and only ever an
  // id: the wording is read from the record server side.
  if (input.check_id !== undefined && typeof input.check_id !== "string") {
    throw new Error("Unknown check.");
  }
  if (input.preset_id !== "firm_checks" && input.check_id) {
    const { check_id: _ignored, ...rest } = input;
    return rest;
  }
  return input;
}


/**
 * The non streaming entry point. Every rule, the daily cap included, lives in
 * runAnalysis, which the streaming route calls as well.
 */
export const startAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateAnalysisInput)
  .handler(async ({ data, context }): Promise<AnalysisRunResult> => {
    const { runAnalysis } = await import("@/lib/analysis-run.server");
    return runAnalysis(context.supabase, context.userId, data);
  });

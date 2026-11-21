import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { chooseFinalInput, draftFinalInput, type ChooseFinalResult, type DraftFinalResult } from "@/lib/proposal-final-shared";

/**
 * 21 Nov 2026, chat pill PR 4c (D-97): deciding the final proposal. Each is requireSupabaseAuth, then its handler in
 * proposal-final.server.ts (requireFirmMember, then the proposal's linked lead or the person who started it). No flag.
 */

/** Records a document as the proposal's final version. A new row each time; the latest counts. */
export const chooseFinalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(chooseFinalInput)
  .handler(async ({ data, context }): Promise<ChooseFinalResult> => (await import("./proposal-final.server")).finalHandlers.choose(context as never, data));

/** Drafts the proposal from its brief and the documents the caller may open, with no board. Saved as their own work. */
export const draftFinalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(draftFinalInput)
  .handler(async ({ data, context }): Promise<DraftFinalResult> => (await import("./proposal-final.server")).finalHandlers.draft(context as never, data));

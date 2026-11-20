import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { askPreviewInput, askSendInput, practiceReplyInput, type AskPreview, type AskResult, type PracticeReplyResult } from "@/lib/lead-ask-shared";

/**
 * 20 Nov 2026, Proposal Desk: asking a proposal's lead by text. Each function is requireSupabaseAuth, then its
 * handler in lead-ask.server.ts, which checks the person, the workspace and the proposal itself. No flag sits in
 * front of it. None of these takes or returns a phone number.
 */

/** The exact words and anything that would stop the text. Writes nothing. */
export const askPreviewFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(askPreviewInput)
  .handler(async ({ data, context }): Promise<AskPreview> => (await import("./lead-ask.server")).askHandlers.preview(context, data));

/** One press of Send. An admin or a lead, never automatic. */
export const askLeadFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(askSendInput)
  .handler(async ({ data, context }): Promise<AskResult> => (await import("./lead-ask.server")).askHandlers.send(context, data));

/** A practice answer to a practice ask. Demo workspaces only, while texting is not switched on. */
export const practiceReplyFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(practiceReplyInput)
  .handler(async ({ data, context }): Promise<PracticeReplyResult> => (await import("./lead-ask.server")).askHandlers.practiceReply(context, data));

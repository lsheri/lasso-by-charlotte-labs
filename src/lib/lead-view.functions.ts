import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  leadDocInput,
  ledInput,
  sendDocsInput,
  type LeadDocResult,
  type LedList,
  type SendDocsResult,
} from "@/lib/lead-view-shared";

/**
 * 21 Nov 2026, chat pill PR 4b (D-97): the Lead's view. Each is requireSupabaseAuth, then its handler in
 * lead-view.server.ts, which starts with requireFirmMember and checks the caller leads the proposal (or, to send
 * documents, started it). No flag.
 */

/** The open proposals this person leads, with the brief, documents once sent, past work and the clock. */
export const listLedFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(ledInput)
  .handler(async ({ data, context }): Promise<LedList> => (await import("./lead-view.server")).leadViewHandlers.list(context as never, data));

/** One document the person who started the proposal sent to this lead. */
export const leadDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(leadDocInput)
  .handler(async ({ data, context }): Promise<LeadDocResult> => (await import("./lead-view.server")).leadViewHandlers.document(context as never, data));

/** The person who started a proposal sends its documents to the lead, or stops sharing them. Sends no text or email. */
export const sendLeadDocsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(sendDocsInput)
  .handler(async ({ data, context }): Promise<SendDocsResult> => (await import("./lead-view.server")).leadViewHandlers.sendDocs(context as never, data));

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { approvalAskInput, approvalDecideInput, approvalFinalInput, type ApprovalResult } from "@/lib/proposal-approval-shared";

/**
 * 21 Nov 2026, chat pill Phase 5 (D-97): the approval loop. Each is requireSupabaseAuth, then its handler in
 * proposal-approval.server.ts (requireFirmMember, then who may do it). No flag. Nothing is texted (Phase 6).
 */

/** The Lead sends the latest final for approval, or takes an open request back. */
export const askApprovalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(approvalAskInput)
  .handler(async ({ data, context }): Promise<ApprovalResult> => (await import("./proposal-approval.server")).approvalHandlers.ask(context as never, data));

/** An admin who does not lead it approves the request or asks for changes. */
export const decideApprovalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(approvalDecideInput)
  .handler(async ({ data, context }): Promise<ApprovalResult> => (await import("./proposal-approval.server")).approvalHandlers.decide(context as never, data));

/** The final an admin is asked to approve, as text. Admins only, while a request is open. */
export const approvalFinalFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(approvalFinalInput)
  .handler(async ({ data, context }): Promise<{ ok: true; title: string; text: string } | { ok: false; problem: string }> =>
    (await import("./proposal-approval.server")).approvalHandlers.final(context as never, data),
  );

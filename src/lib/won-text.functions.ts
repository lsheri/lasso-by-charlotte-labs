import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { wonTextBoardInput, wonTextSendInput, type WonTextResult, type WonTextStatus } from "@/lib/won-text-shared";

/**
 * 19 Nov, Proposal Desk, first live slice: "Text the lead" on a won proposal board. Each function is
 * requireSupabaseAuth, then its handler in won-text.server.ts, which checks the person, the workspace and the board
 * itself. No flag sits in front of the button. Neither function takes a phone number: the one person who agreed to
 * be texted is a server secret.
 */

/** Whether this person has the button on this board, and the exact words. Writes nothing. */
export const wonTextStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(wonTextBoardInput)
  .handler(async ({ data, context }): Promise<WonTextStatus> => (await import("./won-text.server")).wonTextHandlers.status(context, data));

/** One press of Send. */
export const sendWonText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(wonTextSendInput)
  .handler(async ({ data, context }): Promise<WonTextResult> => (await import("./won-text.server")).wonTextHandlers.send(context, data));

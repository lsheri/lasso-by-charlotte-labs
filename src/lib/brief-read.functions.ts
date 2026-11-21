import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { briefReadInput, type BriefReading } from "@/lib/brief-read-shared";
import type { BriefAdmins, BriefPassResult } from "@/lib/pill-proposal-shared";

/**
 * 20 Nov 2026, chat pill PR 3a: reads a pasted brief into the client, what they asked for and the due date, each
 * checked word for word against the paste. Signed in first, then the firm member check in its handler. Writes nothing.
 */
export const readBriefFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(briefReadInput)
  .handler(async ({ data, context }): Promise<BriefReading> =>
    (await import("./brief-read.server")).briefReadHandlers.read(context, data),
  );

/**
 * 20 Nov 2026, chat pill PR 3b: who a Member's pasted brief would go to (the admins), and passing it to them. Signed in,
 * then the firm member check; only Members pass briefs, at most five a day, and it reaches only the app's notifications.
 */
export const briefAdminsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { profile_id?: string | null }) => ({ profile_id: briefReadInput({ text: "x".repeat(12), profile_id: raw?.profile_id ?? null }).profile_id }))
  .handler(async ({ data, context }): Promise<BriefAdmins> => (await import("./brief-pass.server")).briefPassHandlers.admins(context, data));

export const passBriefFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(briefReadInput)
  .handler(async ({ data, context }): Promise<BriefPassResult> => (await import("./brief-pass.server")).briefPassHandlers.pass(context, data));

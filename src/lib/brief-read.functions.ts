import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { briefReadInput, type BriefReading } from "@/lib/brief-read-shared";

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

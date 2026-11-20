import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { FirmCanvasData } from "@/lib/firm-canvas-shared";

type MapInput = { profile_id?: string | null | undefined };

function validate(input: MapInput): MapInput {
  const profileId =
    typeof input?.profile_id === "string" && input.profile_id.trim()
      ? input.profile_id.trim()
      : null;
  return { profile_id: profileId };
}

/**
 * 18 Nov, Firm Brain Build Spec step 3: the firm graph for the map, for the signed-in firm member. The same gate as
 * Ask the firm (requireFirmMember: an active member of a company workspace, never a coach or a guest); no flag sits in front of
 * the view. Read live from the firm reader on every call and stored nowhere, so a board
 * with sharing turned off is gone at the next load. Lesson text is left out: the map never shows it.
 *
 * 20 Nov, D-85: everyone in the firm sees the map. Fees come back for admins and leads only; for everyone else there
 * is no fee record and every money figure is taken out of titles and client names here, before anything is sent.
 */
export const getFirmMap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<FirmCanvasData> => {
    const { requireFirmMember, readFirmCorpus } = await import("./firm-corpus.server");
    const { assembleFirmGraph } = await import("./firm-graph-shared");
    const { canvasDataFor, canvasSeesFees } = await import("./firm-canvas-shared");
    const { profile, supabaseAdmin } = await requireFirmMember(
      context.supabase,
      context.userId,
      data.profile_id,
    );
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    return canvasDataFor(assembleFirmGraph(corpus), corpus, canvasSeesFees(profile.role));
  });

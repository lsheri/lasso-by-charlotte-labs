import type { FirmCanvasData } from "./firm-canvas-shared";

type Db = Parameters<typeof import("./firm-corpus.server").requireFirmMember>[0];

/**
 * The firm map for one signed-in person, as getFirmMap sends it. The same gate as Ask the firm (an active member of a
 * company workspace, never a coach or a guest), checked before anything is read. Read live and stored nowhere, so a
 * board with sharing turned off is gone at the next load. Lesson text never leaves.
 *
 * 20 Nov, D-85: everyone in the firm gets the map. Fees come back for admins and leads only; for everyone else there
 * is no fee record and every money figure is taken out of titles and client names here, before anything is sent.
 */
export async function firmMapFor(
  context: { supabase: Db; userId: string },
  data: { profile_id?: string | null | undefined },
): Promise<FirmCanvasData> {
  const { requireFirmMember, readFirmCorpus } = await import("./firm-corpus.server");
  const { assembleFirmGraph } = await import("./firm-graph-shared");
  const { canvasDataFor, canvasSeesFees } = await import("./firm-canvas-shared");
  const { profile, supabaseAdmin } = await requireFirmMember(
    context.supabase,
    context.userId,
    data.profile_id ?? null,
  );
  const corpus = await readFirmCorpus(supabaseAdmin, profile);
  return canvasDataFor(assembleFirmGraph(corpus), corpus, canvasSeesFees(profile.role));
}

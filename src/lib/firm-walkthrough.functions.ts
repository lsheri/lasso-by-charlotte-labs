import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseWalkTag,
  type FirmWalkthroughResult,
  type WalkKind,
} from "@/lib/firm-walkthrough-shared";

type WalkInput = { kind: WalkKind; tag: string; profile_id?: string | null | undefined };

/** The only thing a person sends is a tag from the fixed lists: there is no free text to carry, log or inject. */
function validateWalkInput(input: WalkInput): WalkInput {
  const tag = parseWalkTag(input?.kind, input?.tag);
  if (!tag) throw new Error("Pick a situation or a method first.");
  const profileId =
    typeof input?.profile_id === "string" && input.profile_id.trim()
      ? input.profile_id.trim()
      : null;
  return { kind: tag.kind, tag: tag.tag, profile_id: profileId };
}

/**
 * 18 Nov, Firm Brain Build Spec step 6: the walk-through for one situation or method. The same gate as Ask the firm
 * (requireFirmMember: an active member of a company workspace, never a coach or a guest); the company-brain flag only
 * hides the button. Read live from the firm reader on every call and stored nowhere, so a board with sharing turned
 * off is gone at the next request. The one event carries the tag's kind and the outcome, never the tag itself.
 */
export const getFirmWalkthrough = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateWalkInput)
  .handler(async ({ data, context }): Promise<FirmWalkthroughResult> => {
    const { requireFirmMember, readFirmCorpus, readFirmItemText, readFirmPeopleNames } =
      await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(
      context.supabase,
      context.userId,
      data.profile_id,
    );
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    const people = await readFirmPeopleNames(supabaseAdmin, profile.org_id);

    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const { runFirmWalkthrough } = await import("./firm-walkthrough.server");
    const meta = await resolveAiMeta(context.supabase as never, {
      surface: "firm_walkthrough",
      orgId: profile.org_id,
      profileId: profile.id,
      userId: context.userId,
    });
    const { result } = await runFirmWalkthrough(
      { chat: chatComplete, loadText: (itemId) => readFirmItemText(supabaseAdmin, corpus, itemId) },
      { corpus, tag: parseWalkTag(data.kind, data.tag)!, people, meta },
    );

    // Counts only: which tag was opened never travels.
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "firm_walkthrough.opened",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { kind: result.kind, result: result.status },
    });
    return result;
  });

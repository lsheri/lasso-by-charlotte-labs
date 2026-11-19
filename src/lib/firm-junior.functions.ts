import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parsePrepareRole,
  type FirmPrepareResult,
  type JuniorTags,
} from "@/lib/firm-junior-shared";

type ProfileInput = { profile_id?: string | null | undefined };

const profileIdOf = (input: ProfileInput | undefined): string | null =>
  typeof input?.profile_id === "string" && input.profile_id.trim() ? input.profile_id.trim() : null;

function validateTagsInput(input: ProfileInput): ProfileInput {
  return { profile_id: profileIdOf(input) };
}

/**
 * 18 Nov, Firm Brain Build Spec step 7: which situations, methods and call roles the firm has shared work for, for
 * the pickers on Home. The same gate as Ask the firm (requireFirmMember: an active member of a company workspace,
 * never a coach or a guest); the company-brain flag only hides the screen. It returns tag keys from the fixed lists
 * and a count of engagements for each, read live from the firm reader: no names, no titles, nothing stored, no event.
 */
export const getFirmJuniorTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateTagsInput)
  .handler(async ({ data, context }): Promise<JuniorTags> => {
    const { requireFirmMember, readFirmCorpus } = await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(
      context.supabase,
      context.userId,
      data.profile_id,
    );
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    const { juniorTags } = await import("./firm-junior-shared");
    return juniorTags(corpus);
  });

type PrepareInput = { role: string; profile_id?: string | null | undefined };

/** The only thing a person sends is a role from the fixed list: there is no free text to carry, log or inject. */
function validatePrepareInput(input: PrepareInput): PrepareInput {
  const role = parsePrepareRole(input?.role);
  if (!role) throw new Error("Pick a role first.");
  return { role, profile_id: profileIdOf(input) };
}

/**
 * 18 Nov, Firm Brain Build Spec step 7: "Prepare me". Past questions the firm asked people in one role, found in
 * code with no model. The same gate as Ask the firm; the flag only hides the screen. A call's own words are read only
 * for someone on its board; everyone else gets lines from its stored summary. Read live on every call and stored
 * nowhere. The one event says whether the role had calls and how it ended, never which role.
 */
export const getFirmPrepare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validatePrepareInput)
  .handler(async ({ data, context }): Promise<FirmPrepareResult> => {
    const { requireFirmMember, readFirmCorpus, readFirmItemText, readFirmPeopleNames } =
      await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(
      context.supabase,
      context.userId,
      data.profile_id,
    );
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    const people = await readFirmPeopleNames(supabaseAdmin, profile.org_id);

    const { runFirmPrepare } = await import("./firm-junior-shared");
    const result = await runFirmPrepare(
      { loadText: (itemId) => readFirmItemText(supabaseAdmin, corpus, itemId) },
      { corpus, role: parsePrepareRole(data.role)!, people },
    );

    // Counts only: which role was picked never travels.
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "prepare.opened",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { role_present: result.status === "none" ? "no" : "yes", result: result.status },
    });
    return result;
  });

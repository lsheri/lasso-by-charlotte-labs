import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  validateCiteInput,
  validateCiteItemInput,
  validateCiteRemoveInput,
  validateWalkOfferInput,
  type CitedLine,
} from "@/lib/firm-cite-shared";

type WithProfile = { profile_id?: string | null | undefined };

/**
 * 18 Nov, Firm Brain Build Spec step 7: "Cite this". Adds one sourced line to an item the caller owns. The same gate
 * as Ask the firm (requireFirmMember), then, in firm-cite.server.ts: the source must be served to the caller by the
 * firm reader now, the words must be found again in what the caller may read of it, and the write goes through the
 * caller's own client to a row they own (no row changed means refused). The text the browser sent is never stored:
 * the source's own words are. No event, and nothing is logged.
 */
export const citeFirmLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { target_item_id: string; source_item_id: string; quote: string } & WithProfile) =>
      validateCiteInput(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string; added: boolean }> => {
    const { requireFirmMember, readFirmCorpus, readFirmItemText } =
      await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(
      context.supabase,
      context.userId,
      data.profile_id,
    );
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    const { citeLine, ownItemDeps } = await import("./firm-cite.server");
    const { citation, added } = await citeLine(
      {
        ...ownItemDeps(context.supabase, profile),
        corpus,
        canSeeFees: profile.role === "admin" || profile.role === "lead",
        loadText: (itemId) => readFirmItemText(supabaseAdmin, corpus, itemId),
        now: () => new Date().toISOString(),
        newId: () => crypto.randomUUID(),
      },
      { targetItemId: data.target_item_id, sourceItemId: data.source_item_id, quote: data.quote },
    );
    return { id: citation.id, added };
  });

/**
 * The cited lines of one item, for its owner only (anyone else gets none). Each line is checked against the firm
 * reader as it is for this request, so when its source's board is no longer shared it comes back with no words and
 * no link. Nothing is stored and there is no event.
 */
export const getFirmCitations = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { item_id: string } & WithProfile) => validateCiteItemInput(input))
  .handler(async ({ data, context }): Promise<CitedLine[]> => {
    const { requireFirmMember, readFirmCorpus } = await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(
      context.supabase,
      context.userId,
      data.profile_id,
    );
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    const { readCitedLines, ownItemDeps } = await import("./firm-cite.server");
    return readCitedLines({ ...ownItemDeps(context.supabase, profile), corpus }, data.item_id);
  });

/** Removes one cited line from an item the caller owns, through the caller's own client. */
export const removeFirmCitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { item_id: string; citation_id: string } & WithProfile) =>
    validateCiteRemoveInput(input),
  )
  .handler(async ({ data, context }): Promise<{ removed: boolean }> => {
    const { requireFirmMember } = await import("./firm-corpus.server");
    const { profile } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const { removeCitedLine, ownItemDeps } = await import("./firm-cite.server");
    return removeCitedLine(ownItemDeps(context.supabase, profile), data.item_id, data.citation_id);
  });

/**
 * The once-only walk-through offer: records on the caller's own item that it was opened or dismissed, so it never
 * shows again on any device. "reset" clears the mark (the owner's own choice to see the offer again; the live check
 * uses it to leave demo data as found). The caller's own client writes a row they own; no row changed means refused.
 */
export const setWalkOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { item_id: string; state: "opened" | "dismissed" | "reset" } & WithProfile) =>
      validateWalkOfferInput(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireFirmMember } = await import("./firm-corpus.server");
    const { profile } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const { saveWalkOffer, ownItemDeps } = await import("./firm-cite.server");
    return saveWalkOffer(
      ownItemDeps(context.supabase, profile),
      data.item_id,
      data.state === "reset" ? null : data.state,
    );
  });

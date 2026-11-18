import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GoodProposal, PastFee, Precedent, ProposalBrief } from "@/lib/proposal-shared";

type BoardInput = { engagement_id: string; profile_id?: string | null | undefined };
type FindInput = BoardInput & { brief: unknown };

const UUID = /^[0-9a-f-]{36}$/i;

function validateBoard(input: BoardInput): BoardInput {
  const id = typeof input?.engagement_id === "string" ? input.engagement_id.trim() : "";
  if (!UUID.test(id)) throw new Error("Unknown board.");
  return { engagement_id: id, profile_id: input?.profile_id ?? null };
}

/**
 * 17 Nov, Start a proposal step 1: the six-line brief, read from this board's notes with the person's own access.
 * Any member of a company workspace may start one on a board they can open, except coaches and guests.
 */
export const draftProposalBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateBoard)
  .handler(async ({ data, context }): Promise<ProposalBrief> => {
    const { requireFirmMember } = await import("./firm-corpus.server");
    const { profile } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const { getItemText, ITEM_TEXT_COLUMNS } = await import("./item-text.server");
    const { readPursuitNotes, draftBrief } = await import("./proposal-precedents.server");
    const caller = context.supabase;
    const notes = await readPursuitNotes(caller, data.engagement_id, async (itemId) => {
      const { data: row } = await caller.from("work_items").select(ITEM_TEXT_COLUMNS).eq("id", itemId).maybeSingle();
      if (!row) return null;
      return (await getItemText(caller, row as never)).text ?? null;
    });
    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(caller as never, { surface: "proposal_brief", orgId: profile.org_id, profileId: profile.id, userId: context.userId });
    const brief = await draftBrief(chatComplete, notes, meta);

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(caller, { eventType: "proposal_draft.started", orgId: profile.org_id, userId: context.userId, dims: { input_kind: "board_notes" } });
    return brief;
  });

export type PrecedentsResult = {
  precedents: Precedent[];
  /** Every other shared engagement, to swap a precedent for. */
  options: Precedent[];
  good: GoodProposal[];
  /** Admins and leads only; empty lists for everyone else. Covers every option, so a swap needs no new request. */
  fees: { fixed: PastFee[]; monthly: PastFee[] };
  canSeeFees: boolean;
  coverage: string;
};

/**
 * 17 Nov, Start a proposal step 1: up to three precedents from work shared with the firm, the firm's client-shown
 * proposals, and past fees for admins and leads. The new board itself never counts as its own precedent.
 */
export const findProposalPrecedents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: FindInput) => ({ ...validateBoard(input), brief: input?.brief }))
  .handler(async ({ data, context }): Promise<PrecedentsResult> => {
    const { requireFirmMember, readFirmCorpus } = await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const full = await readFirmCorpus(supabaseAdmin, profile);
    const corpus = {
      ...full,
      boards: full.boards.filter((board) => board.id !== data.engagement_id),
      items: full.items.filter((item) => item.boardId !== data.engagement_id),
    };
    const { cleanBrief, precedentView, goodProposals, pastFees } = await import("./proposal-shared");
    const { coverageLine } = await import("./firm-corpus-shared");
    const { pickPrecedents } = await import("./proposal-precedents.server");
    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(context.supabase as never, { surface: "proposal_precedents", orgId: profile.org_id, profileId: profile.id, userId: context.userId });

    const picks = await pickPrecedents(chatComplete, corpus, cleanBrief(data.brief), meta);
    const precedents = picks.map((pick) => precedentView(corpus, pick)).filter((view): view is Precedent => view !== null);
    const chosen = new Set(precedents.map((view) => view.boardId));
    const options = corpus.boards
      .filter((board) => !chosen.has(board.id))
      .map((board) => precedentView(corpus, { boardId: board.id, closeness: "loose", why: "" }))
      .filter((view): view is Precedent => view !== null);
    const canSeeFees = profile.role === "admin" || profile.role === "lead";

    const { recordEvent } = await import("./telemetry.server");
    const { bucket } = await import("./telemetry-shared");
    await recordEvent(context.supabase, {
      eventType: "proposal_draft.precedents_shown",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { close: bucket(precedents.filter((view) => view.closeness === "close").length), loose: bucket(precedents.filter((view) => view.closeness === "loose").length) },
    });
    return {
      precedents,
      options,
      good: goodProposals(corpus),
      fees: pastFees(corpus, corpus.boards.map((board) => board.id), canSeeFees),
      canSeeFees,
      coverage: coverageLine(corpus),
    };
  });

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { FIRM_ASK_QUESTION_MAX, FIRM_ASK_STARTERS, type FirmAskResult, type FirmAskStarter } from "@/lib/firm-ask-shared";

type AskInput = { question: string; starter?: FirmAskStarter | null; profile_id?: string | null | undefined };

function validate(input: AskInput): AskInput {
  const question = typeof input?.question === "string" ? input.question.trim() : "";
  if (question.length < 3) throw new Error("Ask a question first.");
  const starter = FIRM_ASK_STARTERS.includes(input?.starter as FirmAskStarter) ? (input.starter as FirmAskStarter) : null;
  return { question: question.slice(0, FIRM_ASK_QUESTION_MAX), starter, profile_id: input?.profile_id ?? null };
}

/**
 * 17 Nov, firm brain: Ask the firm. Any active member of a company workspace may ask, except coaches and guests;
 * no flag sits in front of the box. Answers come only from what the firm reader serves this asker, and
 * nothing is stored. Fees are shown to admins and leads only.
 */
export const askTheFirm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<FirmAskResult> => {
    const { requireFirmMember, readFirmCorpus, readFirmItemText } = await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const corpus = await readFirmCorpus(supabaseAdmin, profile);

    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const { runFirmAsk } = await import("./firm-ask.server");
    const meta = await resolveAiMeta(context.supabase as never, {
      surface: "firm_ask",
      orgId: profile.org_id,
      profileId: profile.id,
      userId: context.userId,
    });
    const { result } = await runFirmAsk(
      { chat: chatComplete, loadText: (itemId) => readFirmItemText(supabaseAdmin, corpus, itemId) },
      { corpus, question: data.question, canSeeFees: profile.role === "admin" || profile.role === "lead", meta },
    );

    // Counts only: the question never travels. Its kind is read in code against the fixed situation and method lists
    // (no model, never its words), so the firm's common questions can be counted without storing any question.
    const { firmAskedDims } = await import("./manager-tools-shared");
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "firm_ask.asked",
      orgId: profile.org_id,
      userId: context.userId,
      dims: firmAskedDims({
        status: result.status,
        boardsRead: corpus.boards.length,
        sources: new Set(result.claims.map((claim) => claim.itemId)).size,
        starter: data.starter,
        question: data.question,
      }),
    });
    return result;
  });

export type FirmSourcePreview = {
  itemId: string;
  title: string;
  boardTitle: string;
  type: string;
  date: string | null;
  /** Full: the item's text (fees withheld unless the reader has fee access). Summary: its index card only. */
  grade: "full" | "summary";
  text: string;
  shownOn: string | null;
  /** The item's author or the board's owner may keep it out of firm answers. */
  canKeepOut: boolean;
  /** Marked as an example of good work. Never who marked it. */
  exemplar: boolean;
  /** Admins and leads may set or remove the mark. */
  canMarkExemplar: boolean;
};

type ItemInput = { item_id: string; profile_id?: string | null | undefined };

function validateItem(input: ItemInput): ItemInput {
  const itemId = typeof input?.item_id === "string" ? input.item_id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new Error("Unknown source.");
  return { item_id: itemId, profile_id: input?.profile_id ?? null };
}

/** May this person keep the item out of firm answers: its author, or the owner of the board it is placed on. */
async function mayKeepOut(admin: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>, profileId: string, itemId: string, boardId: string): Promise<boolean> {
  const [{ data: item }, { data: board }] = await Promise.all([
    admin.from("work_items").select("owner_id").eq("id", itemId).maybeSingle(),
    admin.from("engagements").select("owner_id").eq("id", boardId).maybeSingle(),
  ]);
  return item?.owner_id === profileId || board?.owner_id === profileId;
}

/**
 * A read-only preview of one source in a firm answer, served by the firm reader: nothing it would not let this asker
 * read. Summary-only items show their index card, never their body. Fees in a proposal are withheld unless the reader
 * is an admin or lead.
 */
export const previewFirmSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateItem)
  .handler(async ({ data, context }): Promise<FirmSourcePreview> => {
    const { requireFirmMember, readFirmCorpus, readFirmItemText } = await import("./firm-corpus.server");
    const { withoutFees } = await import("./firm-corpus-shared");
    const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    const item = corpus.items.find((entry) => entry.id === data.item_id);
    const board = item && corpus.boards.find((entry) => entry.id === item.boardId);
    if (!item || !board) throw new Response("Not found", { status: 404 });

    const canSeeFees = profile.role === "admin" || profile.role === "lead";
    const body = item.grade === "full" ? await readFirmItemText(supabaseAdmin, corpus, item.id) : null;
    const text = body !== null ? (canSeeFees ? body : withoutFees(body)) : [item.summary, item.decisions].filter(Boolean).join("\n\n");
    const grade = body !== null ? "full" : "summary";

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "firm_ask.source_opened",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { grade, shown: item.shown.length > 0 },
    });
    return {
      itemId: item.id,
      title: item.title,
      boardTitle: board.title,
      type: item.type,
      date: item.date,
      grade,
      text,
      shownOn: item.shown.at(-1)?.on ?? null,
      canKeepOut: await mayKeepOut(supabaseAdmin, profile.id, item.id, board.id),
      exemplar: item.exemplar === true,
      canMarkExemplar: canSeeFees,
    };
  });

/**
 * "Keep this out of firm answers": sets the item's firm memory to Out. Only its author or the owner of its board may.
 * Nothing is stored elsewhere, so it takes effect on the next question.
 */
export const keepOutOfFirmAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateItem)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { requireFirmMember, readFirmCorpus } = await import("./firm-corpus.server");
    const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
    const corpus = await readFirmCorpus(supabaseAdmin, profile);
    const item = corpus.items.find((entry) => entry.id === data.item_id);
    if (!item || !(await mayKeepOut(supabaseAdmin, profile.id, item.id, item.boardId))) throw new Response("Forbidden", { status: 403 });

    const { data: row } = await supabaseAdmin.from("work_items").select("meta").eq("id", item.id).eq("org_id", profile.org_id).maybeSingle();
    const meta = row?.meta && typeof row.meta === "object" && !Array.isArray(row.meta) ? row.meta : {};
    const { error } = await supabaseAdmin.from("work_items").update({ meta: { ...meta, firm_memory: "out" } }).eq("id", item.id).eq("org_id", profile.org_id);
    if (error) throw new Error(error.message);

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, { eventType: "firm_ask.kept_out", orgId: profile.org_id, userId: context.userId, dims: {} });
    return { ok: true };
  });

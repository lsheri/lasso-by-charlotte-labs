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
 * the company-brain flag only hides the box. Answers come only from what the firm reader serves this asker, and
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

    // Counts only: the question never travels.
    const { recordEvent } = await import("./telemetry.server");
    const { bucket } = await import("./telemetry-shared");
    await recordEvent(context.supabase, {
      eventType: "firm_ask.asked",
      orgId: profile.org_id,
      userId: context.userId,
      dims: {
        result: result.status,
        boards_read: bucket(corpus.boards.length),
        sources: bucket(new Set(result.claims.map((claim) => claim.itemId)).size),
        starter: data.starter ?? "none",
      },
    });
    return result;
  });

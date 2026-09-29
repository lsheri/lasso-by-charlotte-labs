import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { REGISTER_COPY } from "@/lib/register";
import { welcomeGroups, type WelcomeCardId } from "@/lib/welcome-board-copy";
import type { OrgType } from "@/lib/org-type";

const CARD_IDS = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10", "c11", "c12"] as const;
const REGISTERS = Object.keys(REGISTER_COPY) as [OrgType, ...OrgType[]];

const Input = z.object({
  question: z.string().trim().min(1).max(500),
  cardIds: z.array(z.enum(CARD_IDS)).min(1).max(12),
  register: z.enum(REGISTERS),
  orgId: z.string().uuid(),
});

const SYSTEM = [
  "You are answering a new person's question about Lasso itself.",
  "Use only the welcome cards supplied below. Answer in two or three plain sentences.",
  "If the cards do not cover the question, say so plainly instead of guessing.",
  "Never use em dashes.",
].join(" ");

/**
 * WELCOME-ONLY ANSWER PATH. Card text is resolved here from the ids, never
 * taken from the client. Persists nothing: no session, no message, no read
 * log, no event. The welcome cards are product content, not the person's work.
 */
export const answerWelcomeQuestionFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const wanted = new Set<WelcomeCardId>(data.cardIds);
    const cards = welcomeGroups(data.register)
      .flatMap((g) => g.cards)
      .filter((c) => wanted.has(c.id));
    const { chatComplete, resolveAiMeta } = await import("./ai.server");
    const meta = await resolveAiMeta(context.supabase, {
      surface: "welcome_answer",
      orgId: data.orgId,
      userId: context.userId,
    });
    const result = await chatComplete(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: cards.map((c) => `${c.title}: ${c.body}`).join("\n") },
        { role: "user", content: data.question },
      ],
      { tier: "fast", maxTokens: 300, timeoutMs: 20_000, meta },
    );
    return { text: result.text.trim() };
  });

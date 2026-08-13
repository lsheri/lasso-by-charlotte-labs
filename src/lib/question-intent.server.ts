import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  QUESTION_INTENT_CLASSES,
  QUESTION_STAGES,
  QUESTION_TARGETS,
} from "./telemetry-v2-shared";

/**
 * Derived data, not operation. The question text stays where it already lives,
 * tenant private in query_log. What leaves is four enums and a character count.
 * Any failure is skipped in silence: this is enrichment.
 */
export async function classifyQuestionIntent(
  supabase: SupabaseClient<Database>,
  input: {
    userId: string;
    profileId: string;
    question: string;
    scopeMode: string;
    email?: string | null | undefined;
    engagementId?: string | null | undefined;
    workItemId?: string | null | undefined;
  },
): Promise<void> {
  try {
    const { chatComplete } = await import("./ai.server");
    const completion = await chatComplete(
      [
        {
          role: "system",
          content:
            "Classify a question about someone's own work. Answer with JSON only: " +
            `{"intent_class": one of ${QUESTION_INTENT_CLASSES.join("|")}, ` +
            `"target": one of ${QUESTION_TARGETS.join("|")}, ` +
            `"stage": one of ${QUESTION_STAGES.join("|")}}. No other keys, no prose.`,
        },
        { role: "user", content: input.question.slice(0, 2000) },
      ],
      { tier: "fast", timeoutMs: 5000, meta: { surface: "question_intent" } },
    );
    const match = completion.text.match(/\{[\s\S]*\}/);
    if (!match) return;
    const parsed = JSON.parse(match[0]) as Record<string, string>;
    const intent = (QUESTION_INTENT_CLASSES as readonly string[]).includes(
      parsed["intent_class"] ?? "",
    )
      ? parsed["intent_class"]!
      : "other";
    const target = (QUESTION_TARGETS as readonly string[]).includes(parsed["target"] ?? "")
      ? parsed["target"]!
      : input.scopeMode === "engagements"
        ? "engagement"
        : input.scopeMode === "whole"
          ? "own_work"
          : "specific_item";
    const stage = (QUESTION_STAGES as readonly string[]).includes(parsed["stage"] ?? "")
      ? parsed["stage"]!
      : "during";

    const { recordEventV2 } = await import("./telemetry-v2.server");
    await recordEventV2(supabase, input.userId, {
      eventName: "question.asked",
      props: {
        intent_class: intent,
        target,
        stage,
        question_chars: input.question.length,
      },
      profileId: input.profileId,
      engagementId: input.engagementId ?? null,
      workItemId: input.workItemId ?? null,
      email: input.email ?? null,
    });

    // The same classification, kept as a fact row so questions can be studied
    // as practice over time. Enums and a length only: never the question text.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", input.profileId)
      .maybeSingle();
    if (profileRow?.org_id) {
      const { writeQuestionFact } = await import("./facts.server");
      await writeQuestionFact(
        { supabase, orgId: profileRow.org_id, profileId: input.profileId },
        {
          surface: input.scopeMode === "engagements" ? "reflect_engagement" : "reflect",
          intentClass: intent,
          target,
          stage,
          qChars: input.question.length,
          questionText: input.question,
        },
      );
    }
  } catch {
    // Enrichment only. No health row, no user-visible effect.
  }
}

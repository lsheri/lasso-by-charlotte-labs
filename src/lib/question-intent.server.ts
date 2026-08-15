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
  let intent: string | null = null;
  let target: string | null = null;
  let stage: string | null = null;
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
    if (match) {
      const parsed = JSON.parse(match[0]) as Record<string, string>;
      intent = (QUESTION_INTENT_CLASSES as readonly string[]).includes(parsed["intent_class"] ?? "")
        ? parsed["intent_class"]!
        : "other";
      target = (QUESTION_TARGETS as readonly string[]).includes(parsed["target"] ?? "")
        ? parsed["target"]!
        : input.scopeMode === "engagements"
          ? "engagement"
          : input.scopeMode === "whole"
            ? "own_work"
            : "specific_item";
      stage = (QUESTION_STAGES as readonly string[]).includes(parsed["stage"] ?? "")
        ? parsed["stage"]!
        : "during";
    }
  } catch {
    // Enrichment only. No health row, no user-visible effect.
  }

  // The event only travels when the classification produced enums for it.
  if (intent && target && stage) {
    try {
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
    } catch {
      // Enrichment only.
    }
  }

  // The fact row is written whether or not the classification landed: the
  // question happened, and the counts are the point. Enums and a length only,
  // never the question text. Failure here can never fail the person's question.
  try {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", input.profileId)
      .maybeSingle();
    if (!profileRow?.org_id) return;
    const { writeQuestionFact } = await import("./facts.server");
    await writeQuestionFact(
      { supabase, orgId: profileRow.org_id, profileId: input.profileId },
      {
        surface: "ask_lasso",
        intentClass: intent,
        target,
        stage,
        episodeId: input.episodeId ?? null,
        qChars: input.question.length,
        questionText: input.question,
      },
    );
  } catch (e) {
    const { logHealth } = await import("./health.server");
    void logHealth({
      kind: "fact_write_failed",
      surface: "ask_lasso",
      detail: `fact_question write threw: ${(e as Error).message}`,
    });
  }
}

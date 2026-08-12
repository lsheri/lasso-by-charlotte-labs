import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { ContextSource } from "@/lib/reflect-shared";
import type { AnalysisPresetId } from "@/lib/analysis-presets";

export type ReflectInput = {
  session_id: string;
  message: string;
  profile_id?: string | undefined;
  surface?: "reflect" | "ask_lasso" | undefined;
  preset?: AnalysisPresetId | undefined;
};

export type ReflectResult = {
  answer: string;
  truncated: boolean;
  title: string | null;
  fullCount: number;
  summaryCount: number;
  messageId: number | null;
  sources: ContextSource[];
  cutOff: boolean;
};

/** Bucketed so an exact count never leaves as a dimension. */
function tierBucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 5) return "1-5";
  if (n <= 20) return "6-20";
  return "20+";
}

/** Long enough that a real answer is never cut off, short enough to fail loudly. */
const ANSWER_TIMEOUT_MS = 180_000;

/**
 * One Reflect turn. Streams when a delta sink is given, and in both cases the
 * message is written only once the complete answer has been through the quote
 * pipeline, so a half-finished answer is never persisted.
 */
export async function runReflectTurn(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: ReflectInput,
  onDelta?: (delta: string) => void,
): Promise<ReflectResult> {
  const message = data.message.trim();
  if (!message) throw new Error("Write something first.");

  const { resolveProfile } = await import("./profile-resolve");
  const profile = await resolveProfile(supabase, userId, data.profile_id);
  if (!profile) throw new Response("Forbidden", { status: 403 });

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .select("id, profile_id, title, context_scope")
    .eq("id", data.session_id)
    .maybeSingle();
  if (sessionError) throw new Error(sessionError.message);
  if (!session || session.profile_id !== profile.id) {
    throw new Response("Forbidden", { status: 403 });
  }

  const { parseScope, titleFromMessage, REFLECT_SYSTEM_PROMPT } = await import(
    "./reflect-shared"
  );
  const { analysisPreset } = await import("./analysis-presets");
  const scope = parseScope(session.context_scope);
  const preset = data.preset ? analysisPreset(data.preset) : null;

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })
    .limit(40);

  const { assembleReflectContext } = await import("./reflect-context.server");
  const assembled = await assembleReflectContext(supabase, profile.id, scope);

  const surface = data.surface === "ask_lasso" ? "ask_lasso" : "reflect";

  const { chatComplete, streamChat, resolveAiMeta } = await import("./ai.server");
  const conversation = [
    { role: "system" as const, content: REFLECT_SYSTEM_PROMPT },
    ...(preset ? [{ role: "system" as const, content: preset.systemPrompt }] : []),
    {
      role: "system" as const,
      content: `THE PERSON'S RECORDED WORK (scope: ${scope.mode}):\n\n${assembled.context}`,
    },
    ...((history ?? []) as { role: string; content: string }[]).map((m) => ({
      role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];
  const aiMeta = await resolveAiMeta(supabase, {
    surface,
    orgId: profile.org_id,
    userId,
  });
  const completion = onDelta
    ? await streamChat(conversation, onDelta, {
        tier: "smart",
        maxTokens: 8000,
        timeoutMs: ANSWER_TIMEOUT_MS,
        meta: aiMeta,
      })
    : await chatComplete(conversation, {
        tier: "smart",
        maxTokens: 8000,
        timeoutMs: ANSWER_TIMEOUT_MS,
        meta: aiMeta,
      });
  void chatComplete;
  const cutOff = completion.finishReason === "length";
  const { CUT_OFF_NOTE } = await import("./quote-check");
  const raw =
    completion.text || "I couldn't draw an answer out of that. Try asking a different way.";

  // Prevent, verify, repair, then refuse. The reader never sees a warning.
  const { guardQuotes } = await import("./quote-guard.server");
  const guarded = await guardQuotes(raw, assembled.context, cutOff, conversation, aiMeta);
  // Never present a cut-off answer as if it were complete, and never discard it.
  const answer = cutOff ? `${guarded.answer}\n\n${CUT_OFF_NOTE}` : guarded.answer;

  const { data: written, error: insertError } = await supabase
    .from("chat_messages")
    .insert([
      { session_id: session.id, role: "user", content: message },
      { session_id: session.id, role: "assistant", content: answer },
    ])
    .select("id, role");
  if (insertError) throw new Error(insertError.message);

  // The content companion to ai_reads: what was asked, about whose work,
  // and which answer it produced. Tenant content, never telemetry.
  const answerId = (written ?? []).find((row) => row.role === "assistant")?.id ?? null;

  // The audit trail is attached to the exact answer it belongs to.
  const { recordAiReads } = await import("./ai-reads.server");
  await recordAiReads(assembled.reads, {
    surface,
    readerRole: "owner",
    readerProfileId: profile.id,
    messageId: answerId,
  });

  const { quoteBucket } = await import("./quote-check");
  const scopeLabelForLog =
    scope.mode === "whole"
      ? "whole record"
      : scope.mode === "engagements"
        ? "engagement"
        : scope.mode === "tasks"
          ? "task"
          : "item";
  const { error: logError } = await supabase.from("query_log").insert({
    asker_id: profile.id,
    subject_id: profile.id,
    scope: scopeLabelForLog,
    question: message,
    answer_ref: answerId === null ? null : String(answerId),
  });
  if (logError) console.error("[query_log] insert failed:", logError.message);

  const title = session.title ?? titleFromMessage(message);
  await supabase
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", session.id);

  // Content-free by construction: the scope mode is the only dimension.
  const { reportAiAudit } = await import("./ai-health.server");
  await reportAiAudit({
    orgId: profile.org_id,
    orgName: aiMeta.orgName,
    surface,
    model: completion.model,
    question: message,
    answer,
    itemsRead: assembled.sources.map((source) => ({ title: source.title, depth: source.depth })),
    quoteRepairs: guarded.repairs,
    quoteFailures: guarded.failedSpans,
    truncated: assembled.truncated,
    tokensIn: completion.tokensIn + guarded.tokensIn,
    tokensOut: completion.tokensOut + guarded.tokensOut,
    cachedIn: completion.cachedIn,
    costUsd: completion.costUsd + guarded.costUsd,
    durationMs: completion.durationMs,
  });

  const { usageDims } = await import("./ai-usage");
  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(supabase, {
    eventType: "reflect.message_sent",
    orgId: profile.org_id,
    userId,
    dims: {
      scope: scope.mode,
      truncated: assembled.truncated,
      tier2_items: tierBucket(assembled.tier2Count),
      unmatched_quotes: quoteBucket(guarded.unmatchedBefore),
      quote_repairs: quoteBucket(guarded.repairs),
      suppressed_quotes: quoteBucket(guarded.suppressed),
      finish_reason: completion.finishReason,
      ...(preset ? { preset: preset.id } : {}),
    },
  });

  return {
    answer,
    truncated: assembled.truncated,
    title,
    fullCount: assembled.tier2Count,
    summaryCount: Math.max(
      assembled.tier1Count - assembled.tier2Count - assembled.unreadableCount,
      0,
    ),
    messageId: answerId,
    sources: assembled.sources,
    cutOff,
  };
}

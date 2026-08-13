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
  /** "inline" pours the scope in; "catalogue" indexes it and fetches. */
  contextMode: "inline" | "catalogue";
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

/** Content-free bucket for round and fetch counts. */
function smallBucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 2) return "1-2";
  if (n <= 5) return "3-5";
  return "6+";
}

function sizeBucket(n: number): string {
  if (n <= 25) return "0-25";
  if (n <= 100) return "26-100";
  if (n <= 300) return "101-300";
  return "300+";
}

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

  const { parseScope, titleFromMessage, REFLECT_SYSTEM_PROMPT } = await import("./reflect-shared");
  const { analysisPreset } = await import("./analysis-presets");
  const scope = parseScope(session.context_scope);
  const preset = data.preset ? analysisPreset(data.preset) : null;

  const { data: history } = await supabase
    .from("chat_messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })
    .limit(40);

  const surface = data.surface === "ask_lasso" ? "ask_lasso" : "reflect";
  const historyMessages = ((history ?? []) as { role: string; content: string }[]).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
    content: m.content,
  }));
  const prompts = [
    { role: "system" as const, content: REFLECT_SYSTEM_PROMPT },
    ...(preset ? [{ role: "system" as const, content: preset.systemPrompt }] : []),
  ];

  const { chatComplete, streamChat, resolveAiMeta } = await import("./ai.server");
  const aiMeta = await resolveAiMeta(supabase, {
    surface,
    orgId: profile.org_id,
    userId,
  });

  // Above the threshold, the record is too large to pour into one prompt, so
  // the model gets an index of all of it and fetches what the question needs.
  const { scopeItemCount, CATALOGUE_THRESHOLD } = await import("./record-catalogue.server");
  const inScopeCount = await scopeItemCount(supabase, profile.id, scope);
  const contextMode: "inline" | "catalogue" =
    inScopeCount > CATALOGUE_THRESHOLD ? "catalogue" : "inline";

  if (contextMode === "catalogue") {
    const { runCatalogueAnswer } = await import("./record-answer.server");
    const run = await runCatalogueAnswer(
      supabase,
      {
        ownerId: profile.id,
        scope,
        prompts,
        history: historyMessages,
        question: message,
        meta: aiMeta,
        tier: "smart",
        timeoutMs: ANSWER_TIMEOUT_MS,
      },
      onDelta,
    );
    const cutOffCat = run.finishReason === "length";
    const { CUT_OFF_NOTE: CUT_OFF } = await import("./quote-check");
    const { guardQuotes: guard } = await import("./quote-guard.server");
    const guardedCat = await guard(
      run.answer || "I couldn't draw an answer out of that. Try asking a different way.",
      run.quotable,
      cutOffCat,
      [...prompts, { role: "user" as const, content: message }],
      aiMeta,
    );
    const answerCat = cutOffCat ? `${guardedCat.answer}\n\n${CUT_OFF}` : guardedCat.answer;

    if (run.catalogue.entries.length > 0 && run.itemsFetched === 0) {
      const { logHealth } = await import("./health.server");
      void logHealth({
        kind: "empty_context",
        surface,
        orgId: profile.org_id,
        ownerId: profile.id,
        detail: "catalogue answer fetched no item text",
        meta: {
          catalogue_size: run.catalogue.entries.length,
          rounds: run.rounds,
          tool_calls: run.toolCalls,
          scope_mode: scope.mode,
        },
      });
    }

    const written = await persistTurn(supabase, {
      sessionId: session.id,
      question: message,
      answer: answerCat,
      profileId: profile.id,
      scopeMode: scope.mode,
      title: session.title,
    });

    const { recordAiReads } = await import("./ai-reads.server");
    await recordAiReads(run.reads, {
      surface,
      readerRole: "owner",
      readerProfileId: profile.id,
      messageId: written.messageId,
    });

    const { quoteBucket: qb } = await import("./quote-check");
    const { recordEvent: record } = await import("./telemetry.server");
    await record(supabase, {
      eventType: "reflect.message_sent",
      orgId: profile.org_id,
      userId,
      dims: {
        scope: scope.mode,
        context_mode: "catalogue",
        catalogue_size: sizeBucket(run.catalogue.entries.length),
        rounds: smallBucket(run.rounds),
        tool_calls: smallBucket(run.toolCalls),
        searches: smallBucket(run.searches),
        items_fetched: smallBucket(run.itemsFetched),
        truncated: false,
        unmatched_quotes: qb(guardedCat.unmatchedBefore),
        quote_repairs: qb(guardedCat.repairs),
        suppressed_quotes: qb(guardedCat.suppressed),
        finish_reason: run.finishReason,
        ...(preset ? { preset: preset.id } : {}),
      },
    });

    const { classifyQuestionIntent } = await import("./question-intent.server");
    await classifyQuestionIntent(supabase, {
      userId,
      profileId: profile.id,
      question: message,
      scopeMode: scope.mode,
    });

    return {
      answer: answerCat,
      truncated: false,
      title: written.title,
      fullCount: run.itemsFetched,
      summaryCount: run.sources.filter((s) => s.depth === "extract").length,
      messageId: written.messageId,
      sources: run.sources,
      cutOff: cutOffCat,
      contextMode,
    };
  }

  const { assembleReflectContext } = await import("./reflect-context.server");
  const assembled = await assembleReflectContext(supabase, profile.id, scope);

  // The defect class that cost trust before: items were in scope and none of
  // them could be read. Structural counts only, no content.
  if (assembled.itemCount > 0 && assembled.itemCount === assembled.unreadableCount) {
    const { logHealth } = await import("./health.server");
    void logHealth({
      kind: "empty_context",
      surface,
      orgId: profile.org_id,
      ownerId: profile.id,
      detail: "assembler produced zero readable items while items were in scope",
      meta: {
        items_in_scope: assembled.itemCount,
        unreadable: assembled.unreadableCount,
        tier2: assembled.tier2Count,
        scope_mode: scope.mode,
      },
    });
  }

  const conversation = [
    ...prompts,
    {
      role: "system" as const,
      content: `THE PERSON'S RECORDED WORK (scope: ${scope.mode}):\n\n${assembled.context}`,
    },
    ...historyMessages,
    { role: "user" as const, content: message },
  ];
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
  // Verified against verbatim text only: an extract is not a quotable source.
  const guarded = await guardQuotes(raw, assembled.quotable, cutOff, conversation, aiMeta);
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
  const title = await finishTurn(supabase, {
    sessionId: session.id,
    question: message,
    profileId: profile.id,
    scopeMode: scope.mode,
    title: session.title,
    messageId: answerId,
  });

  const { usageDims } = await import("./ai-usage");
  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(supabase, {
    eventType: "reflect.message_sent",
    orgId: profile.org_id,
    userId,
    dims: {
      scope: scope.mode,
      context_mode: "inline",
      truncated: assembled.truncated,
      tier2_items: tierBucket(assembled.tier2Count),
      unmatched_quotes: quoteBucket(guarded.unmatchedBefore),
      quote_repairs: quoteBucket(guarded.repairs),
      suppressed_quotes: quoteBucket(guarded.suppressed),
      finish_reason: completion.finishReason,
      ...(preset ? { preset: preset.id } : {}),
    },
  });

  const { classifyQuestionIntent } = await import("./question-intent.server");
  await classifyQuestionIntent(supabase, {
    userId,
    profileId: profile.id,
    question: message,
    scopeMode: scope.mode,
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
    contextMode,
  };
}

/** The question log, and the session title. Identical in both context modes. */
async function finishTurn(
  supabase: SupabaseClient<Database>,
  input: {
    sessionId: string;
    question: string;
    profileId: string;
    scopeMode: string;
    title: string | null;
    messageId: number | null;
  },
): Promise<string> {
  const { titleFromMessage } = await import("./reflect-shared");
  const scopeLabelForLog =
    input.scopeMode === "whole"
      ? "whole record"
      : input.scopeMode === "engagements"
        ? "engagement"
        : input.scopeMode === "tasks"
          ? "task"
          : "item";
  const { error: logError } = await supabase.from("query_log").insert({
    asker_id: input.profileId,
    subject_id: input.profileId,
    scope: scopeLabelForLog,
    question: input.question,
    answer_ref: input.messageId === null ? null : String(input.messageId),
  });
  if (logError) console.error("[query_log] insert failed:", logError.message);

  const title = input.title ?? titleFromMessage(input.question);
  await supabase
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", input.sessionId);
  return title;
}

/** Writes the pair of messages, then the log and title. */
async function persistTurn(
  supabase: SupabaseClient<Database>,
  input: {
    sessionId: string;
    question: string;
    answer: string;
    profileId: string;
    scopeMode: string;
    title: string | null;
  },
): Promise<{ messageId: number | null; title: string }> {
  const { data: written, error: insertError } = await supabase
    .from("chat_messages")
    .insert([
      { session_id: input.sessionId, role: "user", content: input.question },
      { session_id: input.sessionId, role: "assistant", content: input.answer },
    ])
    .select("id, role");
  if (insertError) throw new Error(insertError.message);
  const messageId = (written ?? []).find((row) => row.role === "assistant")?.id ?? null;
  const title = await finishTurn(supabase, { ...input, messageId });
  return { messageId, title };
}

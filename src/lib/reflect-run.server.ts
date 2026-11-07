import type { SupabaseClient } from "@supabase/supabase-js";

import { earlierReadsNote } from "@/lib/earlier-reads";
import { extractTurnRefs, stripTurnTags, TURN_CITATION_RULE, turnRefsFromCitations, type TurnRef } from "@/lib/turn-labels";
import { INLINE_CHAR_BUDGET } from "@/lib/context-budget";

import type { Database } from "@/integrations/supabase/types";
import { ASK_LASSO_MAKING_RULES, REFLECT_SYSTEM_PROMPT, type ContextScope, type ContextSource, type ScopeSource } from "@/lib/reflect-shared";
import type { AnalysisPresetId } from "@/lib/analysis-presets";
import { shareBucket, type ContextManifest } from "@/lib/context-manifest";
import { renditionsReadBucket } from "./reference-rendition-shared";

export type ReflectInput = {
  session_id: string;
  message: string;
  profile_id?: string | undefined;
  surface?: "reflect" | "ask_lasso" | undefined;
  preset?: AnalysisPresetId | undefined;
  /** Item ids the message points at with @. Narrows this message only. */
  pointed_at?: string[] | undefined;
  scope_source?: ScopeSource | undefined;
  scope_kind?: "section" | undefined;
};

export type ReflectResult = {
  answer: string;
  truncated: boolean;
  title: string | null;
  fullCount: number;
  summaryCount: number;
  /** TOTAL-2: read-set items with nothing stored to read. */
  noTextCount?: number;
  /** TOTAL-2: share of selected text in context, 0 to 1. */
  share?: number;
  messageId: number | null;
  sources: ContextSource[];
  cutOff: boolean;
  /** "inline" pours the scope in; "catalogue" indexes it and fetches. */
  contextMode: "inline" | "catalogue";
  /** Exactly what was read to produce this answer. Null when unknown. */
  manifest: ContextManifest | null;
  /** Unit 2: the turns this answer cites, by work item and turn number. */
  turnRefs: TurnRef[];
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
 * One Reflect turn. Streams when a delta sink is given. The question is saved
 * as soon as it is accepted (AQ-1); the answer is written only once the complete answer has been through the quote
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

  const { parseScope, parseScopeSource, titleFromMessage } = await import("./reflect-shared");
  const { analysisPreset } = await import("./analysis-presets");
  const sessionScope = parseScope(session.context_scope);
  const scopeSource = parseScopeSource(data.scope_source);
  const briefOnly = scopeSource === "board_pick_brief_only";
  let scope = sessionScope;
  // An @ mention dials the read set down to exactly those pieces of work, for
  // this message only. The brief stays ambient.
  const pointed = (data.pointed_at ?? []).filter(Boolean);
  let pointedExcluded: { title: string; reason: string }[] = [];
  if (pointed.length > 0) {
    const { narrowToPointed } = await import("./reflect-context.server");
    const narrowed = await narrowToPointed(supabase, profile.id, sessionScope, pointed);
    scope = narrowed.scope;
    pointedExcluded = narrowed.excluded;
  }
  const isPointed = pointedExcluded.length > 0 || (pointed.length > 0 && scope !== sessionScope);
  const effectiveScopeSource = isPointed ? "pointed" : scopeSource;
  const picked = effectiveScopeSource === "board_pick" ? sessionScope.ids.length : effectiveScopeSource === "board_pick_brief_only" ? 0 : null;
  const preset = data.preset ? analysisPreset(data.preset) : null;

  const { data: storedHistory } = await supabase
    .from("chat_messages")
    .select("id, role, content, context_manifest")
    .eq("session_id", session.id)
    .order("created_at", { ascending: true })
    .limit(40);

  // AQ-1: the question is saved now, before any reading or model call.
  const { ensureQuestionRow } = await import("./ask-question-persist");
  const { history } = await ensureQuestionRow(
    supabase,
    session.id,
    message,
    (storedHistory ?? []) as { id: number; role: string; content: string; context_manifest?: unknown }[],
  );

  const surface = data.surface === "ask_lasso" ? "ask_lasso" : "reflect";
  const historyMessages = ((history ?? []) as { role: string; content: string }[]).map((m) => ({
    role: (m.role === "assistant" ? "assistant" : "user") as "assistant" | "user",
    content: m.content,
  }));
  // Where the person is asking from. The request carries no page, so this is
  // derived from the session scope: one engagement names it, otherwise the
  // whole record (no board open).
  const whereLine = surface === "ask_lasso" ? await whereLineFor(supabase, sessionScope) : null;
  const earlierReads = earlierReadsNote(
    (history ?? []) as { role: string; content: string; context_manifest?: unknown }[],
  );
  // FIX-1: the where-line names the selection, so it changes when the same
  // content is asked about from a different view (whole board, workstream,
  // section). It rides in the question turn with the earlier-reads note, after
  // the cached record, so identical content is one cache entry. The catalogue
  // path has no cached record and keeps both as system notes, as before.
  const prompts = askPrompts({ presetPrompt: preset?.systemPrompt ?? null, surface, whereLine: null });
  const questionNote = [whereLine, earlierReads].filter(Boolean).join("\n\n") || null;
  const cataloguePrompts = [
    ...askPrompts({ presetPrompt: preset?.systemPrompt ?? null, surface, whereLine }),
    ...(earlierReads ? [{ role: "system" as const, content: earlierReads }] : []),
  ];

  const { chatComplete, streamChat, resolveAiMeta } = await import("./ai.server");
  const aiMeta = await resolveAiMeta(supabase, {
    surface,
    orgId: profile.org_id,
    profileId: profile.id,
    userId,
  });

  // Above the threshold, the record is too large to pour into one prompt, so
  // the model gets an index of all of it and fetches what the question needs.
  const catalogueModule = await import("./record-catalogue.server");
  const { scopeItemCount, CATALOGUE_THRESHOLD } = catalogueModule;
  const inScopeCount = await scopeItemCount(supabase, profile.id, scope);
  // TOTAL-1: size decides, not count. The read set goes inline as written
  // whenever its stored text fits the window; only a read set past the
  // window (or past the item ceiling the loader can see) is catalogued.
  let sizeOf: typeof catalogueModule.scopeStoredChars | undefined;
  let windowChars = INLINE_CHAR_BUDGET;
  try {
    sizeOf = catalogueModule.scopeStoredChars;
    windowChars = catalogueModule.CATALOGUE_CHARS ?? windowChars;
  } catch {
    sizeOf = undefined;
  }
  const storedChars =
    !briefOnly && inScopeCount <= CATALOGUE_THRESHOLD && typeof sizeOf === "function"
      ? await sizeOf(supabase, profile.id, scope)
      : 0;
  const overWindow = storedChars > windowChars;
  const contextMode: "inline" | "catalogue" =
    !briefOnly && (inScopeCount > CATALOGUE_THRESHOLD || overWindow) ? "catalogue" : "inline";

  // FIX-1: the catalogue answer, both when size sends the read set there and
  // when the provider refuses an inline prompt as over its window (the size
  // estimate is a ratio, so it can be wrong; the person never sees the error).
  const runCatalogue = async (fallback: boolean): Promise<ReflectResult> => {
    const { runCatalogueAnswer } = await import("./record-answer.server");
    const run = await runCatalogueAnswer(
      supabase,
      {
        ownerId: profile.id,
        scope,
        prompts: cataloguePrompts,
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
      [...cataloguePrompts, { role: "user" as const, content: message }],
      aiMeta,
    );
    const answerCat = stripTurnTags(cutOffCat ? `${guardedCat.answer}\n\n${CUT_OFF}` : guardedCat.answer);
    const turnRefsCat = extractTurnRefs(
      answerCat,
      run.sources.filter((src) => src.type === "ai_thread" && src.depth === "full"),
    );

    const { manifestFromSources } = await import("./context-manifest");
    const catalogueManifest = manifestFromSources(run.sources, {
      briefIncluded: run.catalogue.brief.itemIds.length > 0,
    });
    catalogueManifest.scope = { source: effectiveScopeSource, picked };
    catalogueManifest.excluded = [...catalogueManifest.excluded, ...pointedExcluded];

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
      scopeIds: scope.mode === "whole" ? [] : (scope.ids ?? []),
      title: session.title,
      manifest: catalogueManifest,
    });

    const { recordAiReads } = await import("./ai-reads.server");
    await recordAiReads(run.reads, {
      surface,
      readerRole: "owner",
      readerProfileId: profile.id,
      messageId: written.messageId,
    });

    const { quoteBucket: qb } = await import("./quote-check");
    const { recordEventV2: recV2 } = await import("./telemetry-v2.server");
    await recV2(supabase, userId, {
      eventName: "reflection.completed",
      props: { surface, message_count: run.rounds },
      profileId: profile.id,
    });
    const { recordEvent: record } = await import("./telemetry.server");
    await record(supabase, {
      eventType: "reflect.message_sent",
      orgId: profile.org_id,
      userId,
      profileId: profile.id,
      dims: {
        scope: scope.mode,
        scope_source: effectiveScopeSource,
        ...(data.scope_kind === "section" ? { scope_kind: "section" } : {}),
        context_mode: "catalogue",
        ...(fallback ? { catalogue_fallback: "over_window" } : {}),
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
        answer_retried: run.answerRetried,
        renditions_read: renditionsReadBucket(run.renditionsRead),
        ...(preset ? { preset: preset.id } : {}),
      },
    });

    const { classifyQuestionIntent } = await import("./question-intent.server");
    await classifyQuestionIntent(supabase, {
      userId,
      profileId: profile.id,
      orgId: profile.org_id,
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
      contextMode: "catalogue",
      manifest: catalogueManifest,
      turnRefs: turnRefsCat,
    };
  };
  if (contextMode === "catalogue") return runCatalogue(false);

  const { assembleReflectContext } = await import("./reflect-context.server");
  const assembled = await assembleReflectContext(supabase, profile.id, scope, {
    pointedAt: isPointed,
    briefOnly,
  });
  assembled.manifest.scope = { source: effectiveScopeSource, picked };
  if (pointedExcluded.length > 0) {
    assembled.manifest.excluded = [...assembled.manifest.excluded, ...pointedExcluded];
  }

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

  const { buildReflectConversation } = await import("./prompt-assembly");
  const conversation = buildReflectConversation({
    prompts,
    historyMessages,
    scopeMode: scope.mode,
    context: assembled.context,
    documents: assembled.documents,
    preamble: assembled.preamble,
    perQuestionNote: questionNote,
    message,
  });
  // Chat never asks for a structured tail, but if a model ever emits the
  // sentinel fence it is held back rather than flashed into the answer.
  const { createHoldback, stripHandoffTail } = await import("./handoffs-shared");
  const holdback = onDelta ? createHoldback(onDelta) : null;
  let completion: Awaited<ReturnType<typeof chatComplete>>;
  try {
    completion = onDelta
      ? await streamChat(conversation, (delta) => holdback!.push(delta), {
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
  } catch (e) {
    // A refusal for size comes back before any text, so nothing has streamed.
    if ((e as { errorClass?: string } | null)?.errorClass === "context_length") return runCatalogue(true);
    throw e;
  }
  void chatComplete;
  const cutOff = completion.finishReason === "length";
  const { CUT_OFF_NOTE } = await import("./quote-check");
  const streamed =
    completion.text || "I couldn't draw an answer out of that. Try asking a different way.";
  // No chat preset carries a handoff kind, so a fence here is never a valid
  // block: it is flushed back as prose and the answer stays whole.
  const strippedChat = stripHandoffTail(streamed, null);
  holdback?.end(strippedChat.block !== null);
  const raw = strippedChat.block ? strippedChat.prose : streamed;

  // Prevent, verify, repair, then refuse. The reader never sees a warning.
  const { guardQuotes } = await import("./quote-guard.server");
  // Verified against verbatim text only: an extract is not a quotable source.
  // TOTAL-2: with citations in hand the guard verifies against them and never
  // spends a second model call; the repair turn is only for the OpenAI hop.
  const citedTexts = (completion.citations ?? []).map((c) => c.cited_text);
  const guarded = await guardQuotes(raw, assembled.quotable, cutOff, conversation, aiMeta, {
    citedTexts,
    repair: citedTexts.length === 0,
  });
  // Never present a cut-off answer as if it were complete, and never discard it.
  const answer = stripTurnTags(cutOff ? `${guarded.answer}\n\n${CUT_OFF_NOTE}` : guarded.answer);

  // TOTAL-1: the verified pointers the model returned, kept beside the answer.
  // Content stays in the person's own row, never in telemetry.
  const citations = (completion.citations ?? []).slice(0, 60).map((c) => ({
    item_id: c.document_id,
    turn_no: c.turn_no,
    text: c.cited_text.slice(0, 400),
  }));
  // FIX-1: when the model cited turns, the chips come from those citations
  // alone; turn numbers read out of the prose can attach to the wrong chat.
  const fullThreads = assembled.sources.filter((src) => src.type === "ai_thread" && src.depth === "full");
  const turnRefs = turnRefsFromCitations(citations, fullThreads, extractTurnRefs(answer, fullThreads));
  const manifestToStore = citations.length > 0 ? { ...assembled.manifest, citations } : assembled.manifest;
  const { data: written, error: insertError } = await supabase
    .from("chat_messages")
    .insert([
      {
        session_id: session.id,
        role: "assistant",
        content: answer,
        context_manifest: manifestToStore as unknown as never,
      },
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
    scopeIds: scope.mode === "whole" ? [] : (scope.ids ?? []),
    title: session.title,
    messageId: answerId,
  });

  const { usageDims } = await import("./ai-usage");
  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(supabase, {
    eventType: "reflect.message_sent",
    orgId: profile.org_id,
    userId,
    profileId: profile.id,
    dims: {
      scope: scope.mode,
      scope_source: effectiveScopeSource,
      ...(data.scope_kind === "section" ? { scope_kind: "section" } : {}),
      context_mode: "inline",
      truncated: assembled.truncated,
      tier2_items: tierBucket(assembled.tier2Count),
      unmatched_quotes: quoteBucket(guarded.unmatchedBefore),
      quote_repairs: quoteBucket(guarded.repairs),
      suppressed_quotes: quoteBucket(guarded.suppressed),
      finish_reason: completion.finishReason,
      renditions_read: renditionsReadBucket(assembled.renditionsRead ?? 0),
      context_share: shareBucket(assembled.readSet?.share),
      ...(preset ? { preset: preset.id } : {}),
    },
  });

  const { classifyQuestionIntent } = await import("./question-intent.server");
  await classifyQuestionIntent(supabase, {
    userId,
    profileId: profile.id,
    orgId: profile.org_id,
    question: message,
    scopeMode: scope.mode,
  });

  const noTextCount = assembled.manifest.items.filter(
    (item) => item.chars_total === 0 && /no stored text/i.test(item.detail),
  ).length;

  return {
    answer,
    truncated: assembled.truncated,
    title,
    fullCount: assembled.tier2Count,
    summaryCount: Math.max(
      assembled.tier1Count - assembled.tier2Count - assembled.unreadableCount - noTextCount,
      0,
    ),
    noTextCount,
    share: assembled.readSet?.share,
    messageId: answerId,
    sources: assembled.sources,
    cutOff,
    contextMode,
    manifest: assembled.manifest,
    turnRefs,
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
    /** The ids the scope genuinely targeted; never widened or invented. */
    scopeIds?: string[] | undefined;
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
  // A question is only stamped with a scope it actually ran against: one
  // engagement, or one piece of work. Anything wider stays unscoped.
  const ids = input.scopeIds ?? [];
  const single = ids.length === 1 ? ids[0]! : null;
  const { error: logError } = await supabase.from("query_log").insert({
    asker_id: input.profileId,
    subject_id: input.profileId,
    scope: scopeLabelForLog,
    question: input.question,
    answer_ref: input.messageId === null ? null : String(input.messageId),
    engagement_id: input.scopeMode === "engagements" ? single : null,
    work_item_id: input.scopeMode === "items" ? single : null,
  });
  if (logError) console.error("[query_log] insert failed:", logError.message);

  const title = input.title ?? titleFromMessage(input.question);
  await supabase
    .from("chat_sessions")
    .update({ title, updated_at: new Date().toISOString() })
    .eq("id", input.sessionId);
  return title;
}

/** Writes the answer (the question is already saved), then the log and title. */
async function persistTurn(
  supabase: SupabaseClient<Database>,
  input: {
    sessionId: string;
    question: string;
    answer: string;
    profileId: string;
    scopeMode: string;
    scopeIds?: string[] | undefined;
    title: string | null;
    manifest?: ContextManifest | null;
  },
): Promise<{ messageId: number | null; title: string }> {
  const { data: written, error: insertError } = await supabase
    .from("chat_messages")
    .insert([
      {
        session_id: input.sessionId,
        role: "assistant",
        content: input.answer,
        context_manifest: input.manifest ? (input.manifest as unknown as never) : null,
      },
    ])
    .select("id, role");
  if (insertError) throw new Error(insertError.message);
  const messageId = (written ?? []).find((row) => row.role === "assistant")?.id ?? null;
  const title = await finishTurn(supabase, { ...input, messageId });
  return { messageId, title };
}

/** The one line that says where the person is asking from, derived from the session scope. */
export async function whereLineFor(supabase: SupabaseClient<Database>, sessionScope: ContextScope): Promise<string> {
  const { scopeLabel } = await import("./reflect-shared");
  let place = "Ask Lasso, across their whole record, with no board open";
  if (sessionScope.mode === "engagements" && sessionScope.ids.length === 1) {
    const { data: engagement } = await supabase
      .from("engagements")
      .select("title")
      .eq("id", sessionScope.ids[0]!)
      .maybeSingle();
    if (engagement?.title) place = `Ask Lasso, on the workboard ${engagement.title}`;
  } else if (sessionScope.mode !== "whole" && sessionScope.ids.length > 0) {
    place = `Ask Lasso, on a chosen set of ${scopeLabel(sessionScope).toLowerCase()}`;
  }
  return `WHERE THE PERSON IS: ${place}.`;
}

/** The system prompts every Ask turn starts with. Byte identical between a prime and the question that follows it. */
export function askPrompts(input: { presetPrompt?: string | null; surface: "ask_lasso" | "reflect"; whereLine: string | null }): { role: "system"; content: string }[] {
  return [
    { role: "system" as const, content: REFLECT_SYSTEM_PROMPT },
    ...(input.presetPrompt ? [{ role: "system" as const, content: input.presetPrompt }] : []),
    ...(input.surface === "ask_lasso" ? [{ role: "system" as const, content: ASK_LASSO_MAKING_RULES }] : []),
    ...(input.whereLine ? [{ role: "system" as const, content: input.whereLine }] : []),
    { role: "system" as const, content: TURN_CITATION_RULE },
  ];
}

export type PrimeInput = { profile_id?: string; scope: unknown };

/**
 * TOTAL-5: warm the cache for a read set before the question is typed. The
 * same prompts, the same record, the same acknowledgement as the question
 * that follows, then a one-token call, so the record is a cache hit when the
 * person presses Send. Content never leaves beyond what the question itself
 * would send, and the reads are recorded like any other read. Returns
 * counts only.
 */
export async function primeReflectContext(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: PrimeInput,
): Promise<{ primed: boolean; reason?: string; tokens_in?: number; cache_write_in?: number }> {
  const { resolveProfile } = await import("./profile-resolve");
  const profile = await resolveProfile(supabase, userId, data.profile_id);
  if (!profile) throw new Response("Forbidden", { status: 403 });
  const { parseScope } = await import("./reflect-shared");
  const scope = parseScope(data.scope);
  if (scope.mode === "whole") return { primed: false, reason: "whole_record" };

  const catalogueModule = await import("./record-catalogue.server");
  const count = await catalogueModule.scopeItemCount(supabase, profile.id, scope);
  if (count === 0) return { primed: false, reason: "empty" };
  if (count > catalogueModule.CATALOGUE_THRESHOLD) return { primed: false, reason: "catalogue" };
  const stored = await catalogueModule.scopeStoredChars(supabase, profile.id, scope);
  if (stored > catalogueModule.CATALOGUE_CHARS) return { primed: false, reason: "catalogue" };

  // FIX-1: the where-line rides in the question turn, so the prime leaves it out.
  const prompts = askPrompts({ surface: "ask_lasso", whereLine: null });
  const { assembleReflectContext } = await import("./reflect-context.server");
  const assembled = await assembleReflectContext(supabase, profile.id, scope, { pointedAt: false, briefOnly: false });
  if (assembled.documents.length === 0) return { primed: false, reason: "nothing_to_read" };
  const { buildReflectConversation } = await import("./prompt-assembly");
  const conversation = buildReflectConversation({
    prompts,
    historyMessages: [],
    scopeMode: scope.mode,
    context: assembled.context,
    documents: assembled.documents,
    preamble: assembled.preamble,
    message: "Ready.",
  });
  const { chatComplete, resolveAiMeta } = await import("./ai.server");
  const aiMeta = await resolveAiMeta(supabase, { surface: "ask_prime", orgId: profile.org_id, profileId: profile.id, userId });
  const result = await chatComplete(conversation, { tier: "smart", maxTokens: 1, timeoutMs: ANSWER_TIMEOUT_MS, meta: aiMeta, awaitAccounting: true });
  return { primed: true, tokens_in: result.tokensIn, cache_write_in: Math.max(0, result.tokensIn - result.cachedIn) };
}

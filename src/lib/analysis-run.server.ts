import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { analysisRunDims } from "@/lib/analysis-dims";
import type { AnalysisPresetId } from "@/lib/analysis-presets";
import { tokensBucket } from "@/lib/ai-usage";
import type { ContextManifest } from "@/lib/context-manifest";

export type AnalysisInput = {
  preset_id: AnalysisPresetId;
  work_item_id?: string | undefined;
  engagement_id?: string | undefined;
  profile_id?: string | undefined;
  /**
   * One firm check, by id only. Never the check text: the server resolves the
   * id through the caller's client and refuses if it is retired or no longer
   * applies. Ignored by every preset other than firm_checks.
   */
  check_id?: string | undefined;
  /** "shown" when the person confirmed a two step activation before the run. */
  confirm_step?: "shown" | undefined;
};


export type AnalysisRunResult = {
  run_id: string;
  session_id: string;
  reused: boolean;
  items_read: number;
  suppressed: number;
  /** Exact count, used for the human label on the finding. */
  claims: number;
  /** Exactly what this run read. Null for runs that record no manifest. */
  manifest: ContextManifest | null;
  /** The final, guarded answer. Streaming callers replace their buffer with it. */
  answer: string | null;
};

function costBucket(usd: number): string {
  if (usd <= 0.01) return "<=0.01";
  if (usd <= 0.05) return "0.01-0.05";
  if (usd <= 0.2) return "0.05-0.20";
  return "0.20+";
}

function smallBucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 2) return "1-2";
  if (n <= 9) return "3-9";
  return "10+";
}

/** The last answer already written into a session, for a reused run. */
async function priorAnswer(
  supabase: SupabaseClient<Database>,
  sessionId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("chat_messages")
    .select("content")
    .eq("session_id", sessionId)
    .eq("role", "assistant")
    .order("created_at", { ascending: true });
  const last = (data ?? []).at(-1);
  return last?.content ?? null;
}

/**
 * The one execution path every analysis runs through: a run row, a scoped
 * session, the preset prompt, the quote pipeline, then the run closed out with
 * real counts and cost. The daily cap and the profile check live in here, so
 * no caller, RPC or HTTP, can go round them.
 */
export async function runAnalysis(
  supabase: SupabaseClient<Database>,
  userId: string,
  data: AnalysisInput,
  onDelta?: (delta: string) => void,
): Promise<AnalysisRunResult> {

  const { resolveProfile } = await import("./profile-resolve");
  const profile = await resolveProfile(supabase, userId, data.profile_id);
  if (!profile) throw new Response("Forbidden", { status: 403 });

  const { analysisPreset, MIN_ITEMS_FOR_RECURRENCE, NOT_ENOUGH_WORK_LINE } =
    await import("./analysis-presets");
  const preset = analysisPreset(data.preset_id);
  if (!preset) throw new Error("Unknown analysis.");

  const { resolveAnalysisTarget } = await import("./analysis-scope.server");
  const target = await resolveAnalysisTarget(supabase, {
    scope: preset.scope,
    profileId: profile.id,
    workItemId: data.work_item_id ?? null,
    engagementId: data.engagement_id ?? null,
  });
  const isOwner = target.ownerId === profile.id;
  if (!isOwner && !preset.coachMayRun) throw new Response("Forbidden", { status: 403 });
  if (preset.id === "what_recurs" && target.itemsInScope < MIN_ITEMS_FOR_RECURRENCE) {
    throw new Error(NOT_ENOUGH_WORK_LINE);
  }
  // Nothing readable means nothing to analyse. This refusal comes before any
  // run row is created, so an empty scope never leaves a record behind. It
  // is what a coach meets when a share is taken back mid session.
  if (target.itemsInScope === 0) {
    throw new Error(
      "There is nothing here to read. This work may no longer be shared with you.",
    );
  }
  // One named check, resolved BEFORE any run row exists, so a retired or
  // inapplicable check is refused honestly with nothing written. Only the id
  // travels from the browser; the wording always comes from the record.
  let singleCheck: { title: string; body: string } | null = null;
  if (preset.id === "firm_checks" && data.check_id) {
    const { resolveSingleCheck, CHECK_UNAVAILABLE_LINE } = await import("./firm-checks.server");
    singleCheck = await resolveSingleCheck(supabase, {
      orgId: profile.org_id,
      ownerProfileId: target.ownerId,
      workItemId: target.scopeId,
      checkId: data.check_id,
    });
    if (!singleCheck) throw new Error(CHECK_UNAVAILABLE_LINE);
  }

  const profileOrgId = profile.org_id;
  const presetId = preset.id;

  // A single check run is its own piece of work, so it never reuses the run
  // row of "all checks" or of a different check.
  const checkKeyPart = singleCheck && data.check_id ? `:check:${data.check_id}` : "";
  const baseIdempotencyKey = `${preset.id}:${target.scopeType}:${target.scopeId}:${profile.id}${checkKeyPart}`;
  let idempotencyKey = baseIdempotencyKey;

  const { recordEvent } = await import("./telemetry.server");
  const scopeType = target.scopeType;
  let aiMeta: Awaited<ReturnType<(typeof import("./ai.server"))["resolveAiMeta"]>>;
  let session: { id: string };
  let run: { id: string };
  try {
    const { assertUnderDailyCap } = await import("./analysis-cap.server");
    await assertUnderDailyCap(supabase, profile.id);

    const { resolveAiMeta } = await import("./ai.server");
    aiMeta = await resolveAiMeta(supabase, {
      surface: `analysis:${preset.id}`,
      orgId: profile.org_id,
      userId,
    });

    // This read intentionally uses the caller client. RLS decides which run
    // the authenticated person may reuse. A run that already exists for this
    // exact work is a result to show, never an error: the unique key is the
    // feature, so running, completed and mid flight duplicates all reuse.
    const { data: existing } = await supabase
      .from("analysis_runs")
      .select(
        "id, session_id, status, items_read, suppressed_claims, claims_rendered, context_manifest",
      )
      .eq("idempotency_key", idempotencyKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing && existing.status !== "failed" && existing.session_id) {
      const { parseManifest } = await import("./context-manifest");
      return {
        run_id: existing.id,
        session_id: existing.session_id,
        reused: true,
        items_read: existing.items_read ?? 1,
        suppressed: existing.suppressed_claims ?? 0,
        claims: existing.claims_rendered ?? 0,
        manifest: parseManifest(existing.context_manifest),
        answer: await priorAnswer(supabase, existing.session_id),
      };
    }
    // A previous attempt that failed must be allowed to run again, so it
    // gets its own key rather than colliding with the failed row.
    if (existing) idempotencyKey = `${baseIdempotencyKey}:${Date.now()}`;

    await recordEvent(supabase, {
      eventType: "analysis.started",
      orgId: profile.org_id,
      userId,
      dims: {
        preset: preset.id,
        scope_type: preset.scope,
        deliverable_kind: target.deliverableKind ?? "unset",
        ...(data.confirm_step === "shown" ? { confirm_step: "shown" } : {}),
      },
    });

    const { data: createdSession, error: sessionError } = await supabase
      .from("chat_sessions")
      .insert({
        profile_id: profile.id,
        org_id: profile.org_id,
        context_scope: target.scope,
        title: `${preset.label}: ${target.title}`.slice(0, 120),
      })
      .select("id")
      .single();
    if (sessionError || !createdSession) {
      throw new Error(sessionError?.message ?? "analysis_session_create_failed");
    }
    session = createdSession;

    const { createRun } = await import("./analysis-runs.server");
    try {
      run = await createRun({
        preset: preset.dbPreset,
        scope_type: target.scopeType,
        scope_id: target.scopeId,
        idempotency_key: idempotencyKey,
        org_id: profile.org_id,
        owner_id: target.ownerId,
        run_by_profile_id: profile.id,
        session_id: session.id,
      });
    } catch (collision) {
      // Two clicks in the same second land here. The other click owns a run
      // for this exact work, so show that one rather than an error.
      const { findRunByKey } = await import("./analysis-runs.server");
      const other = await findRunByKey(idempotencyKey);
      if (other?.session_id) {
        const { parseManifest } = await import("./context-manifest");
        return {
          run_id: other.id,
          session_id: other.session_id,
          reused: true,
          items_read: other.items_read ?? 1,
          suppressed: other.suppressed_claims ?? 0,
          claims: other.claims_rendered ?? 0,
          manifest: parseManifest(other.context_manifest),
          answer: await priorAnswer(supabase, other.session_id),
        };
      }
      throw collision;
    }
  } catch (error) {
    const rawReason = error instanceof Error ? error.message : "analysis_start_failed";
    const errorClass = "start_error";
    try {
      const { logHealth } = await import("./health.server");
      await logHealth({
        kind: "error",
        surface: "analysis",
        orgId: profile.org_id,
        ownerId: target.ownerId,
        detail: rawReason,
        meta: { preset: preset.id, error_class: errorClass },
      });
    } catch {
      // Health reporting must never replace the human-facing start error.
    }
    try {
      await recordEvent(supabase, {
        eventType: "analysis.run",
        orgId: profileOrgId,
        userId,
        dims: analysisRunDims({
          preset: presetId,
          scopeType,
          status: "failed",
          errorClass,
          itemsRead: 0,
          costUsd: 0,
          claims: 0,
          suppressed: 0,
        }),
      });
      const { recordEventV2 } = await import("./telemetry-v2.server");
      await recordEventV2(supabase, userId, {
        eventName: "analysis.failed",
        props: { preset: presetId, scope: scopeType, reason_class: errorClass },
        profileId: profile?.id ?? null,
      });
    } catch {
      // Telemetry failure must not expose an internal error to the person.
    }
    throw new Error("That analysis could not start. Try again.");
  }
  const runId = run.id;
  {
    const { recordEventV2 } = await import("./telemetry-v2.server");
    await recordEventV2(supabase, userId, {
      eventName: "analysis.started",
      props: {
        preset: presetId,
        scope: scopeType,
        deliverable_kind: target.deliverableKind ?? "unset",
        ...(data.confirm_step === "shown" ? { confirm_step: "shown" as const } : {}),
      },
      profileId: profile.id,
    });
  }
  let costSoFar = 0;
  let itemsReadSoFar = 0;
  let claimsSoFar = 0;
  let suppressedSoFar = 0;

  async function fail(reason: string): Promise<never> {
    try {
      const { failRun } = await import("./analysis-runs.server");
      await failRun(runId, reason);
    } catch {
      // Continue through health reporting and the human-facing error.
    }
    try {
      await recordEvent(supabase, {
        eventType: "analysis.run",
        orgId: profileOrgId,
        userId,
        dims: analysisRunDims({
          preset: presetId,
          scopeType,
          status: "failed",
          errorClass: reason,
          itemsRead: itemsReadSoFar,
          costUsd: costSoFar,
          claims: claimsSoFar,
          suppressed: suppressedSoFar,
        }),
      });
      await recordEvent(supabase, {
        eventType: "analysis.failed",
        orgId: profileOrgId,
        userId,
        dims: { preset: presetId, reason_class: reason },
      });
      const { recordEventV2 } = await import("./telemetry-v2.server");
      await recordEventV2(supabase, userId, {
        eventName: "analysis.failed",
        props: { preset: presetId, scope: scopeType, reason_class: reason.slice(0, 48) },
        profileId: profile?.id ?? null,
      });
    } catch {
      // Telemetry failure must not replace the analysis error.
    }
    try {
      const { logHealth } = await import("./health.server");
      await logHealth({
        kind: "error",
        surface: "analysis",
        orgId: profileOrgId,
        ownerId: target.ownerId,
        detail: reason,
        meta: { preset: presetId },
      });
    } catch {
      // The analysis failure remains the error returned to the person.
    }
    throw new Error(
      reason === "timeout"
        ? "That took too long to finish. Try again."
        : "That analysis could not be completed.",
    );
  }

  try {
    // "What fed this" writes through the lineage drafter rather than a second
    // model pass: draft links only, upserted, nothing recorded until the
    // person confirms them in the What fed this section.
    if (preset.id === "what_fed_this") {
      const { draftLineageFor } = await import("./lineage.server");
      const drafted = await draftLineageFor(supabase, {
        deliverableId: target.scopeId,
        ownerId: target.ownerId,
        orgId: profile.org_id,
        runnerProfileId: profile.id,
        coachMayRun: preset.coachMayRun,
      });
      const { renderDraftedLineage } = await import("./analysis-scope.server");
      const rendered = await renderDraftedLineage(supabase, target.scopeId, target.title);

      const { data: lineageWritten } = await supabase
        .from("chat_messages")
        .insert([
          { session_id: session.id, role: "user", content: preset.openingMessage },
          { session_id: session.id, role: "assistant", content: rendered.text },
        ])
        .select("id, role");
      const lineageAnswerId =
        (lineageWritten ?? []).find((row) => row.role === "assistant")?.id ?? null;

      const { recordAiReads } = await import("./ai-reads.server");
      await recordAiReads(
        [{ workItemId: target.scopeId, ownerId: target.ownerId, depth: "full" }],
        {
          surface: "ask_lasso",
          readerRole: isOwner ? "owner" : "coach",
          readerProfileId: profile.id,
          messageId: lineageAnswerId,
        },
      );

      const lineageCost = Number((drafted.usage?.costUsd ?? 0).toFixed(6));
      const lineageItems = drafted.considered + 1;
      costSoFar = lineageCost;
      itemsReadSoFar = lineageItems;
      claimsSoFar = rendered.considered;

      const { completeRun } = await import("./analysis-runs.server");
      await completeRun(runId, {
        items_read: lineageItems,
        tokens_in: drafted.usage?.tokensIn ?? 0,
        tokens_out: 0,
        cost_usd: lineageCost,
        claims_rendered: rendered.considered,
        suppressed_claims: 0,
      });

      await recordEvent(supabase, {
        eventType: "analysis.run",
        orgId: profile.org_id,
        userId,
        dims: analysisRunDims({
          preset: preset.id,
          scopeType,
          status: "completed",
          itemsRead: lineageItems,
          costUsd: lineageCost,
          claims: rendered.considered,
          suppressed: 0,
        }),
      });

      const { recordEventV2 } = await import("./telemetry-v2.server");
      await recordEventV2(supabase, userId, {
        eventName: "analysis.completed",
        props: {
          preset: preset.id,
          scope: scopeType,
          items_read: lineageItems,
          claims_rendered: rendered.considered,
          suppressed: 0,
        },
        profileId: profile.id,
      });
      // Fire and forget. A fact that cannot land never fails an analysis.
      const { writeAnalysisFinding } = await import("./facts.server");
      void writeAnalysisFinding(
        { supabase, orgId: profile.org_id, profileId: profile.id },
        {
          analysisRunId: runId,
          presetId: preset.id,
          presetVersion: "v1",
          scope: scopeType,
          evidenceCount: lineageItems,
        },
      ).catch(() => undefined);

      return {
        run_id: runId,
        session_id: session.id,
        reused: false,
        items_read: lineageItems,
        suppressed: 0,
        claims: rendered.considered,
        manifest: null,
        answer: rendered.text,
      };
    }

    const { assembleReflectContext } = await import("./reflect-context.server");
    const assembled = await assembleReflectContext(supabase, profile.id, target.scope, {
      ownerProfileId: target.ownerId,
      readerRole: isOwner ? "owner" : "coach",
    });

    const { REFLECT_SYSTEM_PROMPT } = await import("./reflect-shared");
    // The firm's own checks are part of the prompt for this preset, and the
    // analysis cannot run without at least one of them.
    let checksBlock: string | null = null;
    let firmCheckCount = 0;
    if (preset.id === "firm_checks") {
      const { applicableFirmChecksForChat, renderChecksBlock } = await import(
        "./firm-checks.server"
      );
      // A named check runs alone: only its own wording reaches the prompt.
      const checks = singleCheck
        ? [singleCheck]
        : (
            await applicableFirmChecksForChat(supabase, {
              orgId: profile.org_id,
              ownerProfileId: target.ownerId,
              workItemId: target.scopeId,
            })
          ).checks;

      if (checks.length === 0) await fail("no_firm_checks");
      firmCheckCount = checks.length;
      checksBlock = renderChecksBlock(checks);
    }

    // The owner's own label for the artifact, one line, prompts stay generic.
    const { deliverableKindLabel } = await import("./deliverable-kinds");
    const kindLine =
      preset.scope === "deliverable" && target.deliverableKind
        ? `\n\nThe deliverable is a ${deliverableKindLabel(target.deliverableKind)}.`
        : "";
    // The structured tail is a SEPARATE message block. No preset prompt is
    // edited by it, so the answer a person reads keeps its own contract.
    const { HANDOFF_PRESETS, NO_HANDOFF_PRESETS, tailInstruction } =
      await import("./handoffs-shared");
    const handoffKind = (NO_HANDOFF_PRESETS as readonly string[]).includes(preset.id)
      ? null
      : (HANDOFF_PRESETS[preset.id] ?? null);
    // The firm's checks are their own message, so the preset prefix ahead of
    // them is byte identical between runs and can be cached by the model.
    const { buildAnalysisConversation } = await import("./prompt-assembly");
    const conversation = buildAnalysisConversation({
      systemPrompt: REFLECT_SYSTEM_PROMPT,
      presetPrompt: preset.systemPrompt,
      checksBlock,
      heading:
        preset.scope === "thread" ? "THE CONVERSATION UNDER ANALYSIS" : "THE WORK UNDER ANALYSIS",
      context: assembled.context,
      kindLine,
      tailInstruction: handoffKind ? tailInstruction(handoffKind) : null,
      openingMessage: preset.openingMessage,
    });

    const { chatComplete, streamChat } = await import("./ai.server");
    const options = { tier: "smart" as const, maxTokens: 8000, meta: aiMeta };
    // Analysis presets DO ask for a structured tail, so deltas go through the
    // same holdback the chat path uses: the sentinel fence is never flashed at
    // a reader, and an ordinary fence is released as prose.
    const { createHoldback } = await import("./handoffs-shared");
    const holdback = onDelta ? createHoldback(onDelta) : null;
    const completion = onDelta
      ? await streamChat(conversation, (delta) => holdback!.push(delta), options)
      : await chatComplete(conversation, options);
    const cutOff = completion.finishReason === "length";
    const { CUT_OFF_NOTE } = await import("./quote-check");

    // Strip the tail BEFORE the quote guard and before anything is stored,
    // so no reader ever meets the fence, in the answer or in the history.
    const { stripHandoffTail, quoteFields, handoffsBucket } = await import("./handoffs-shared");
    const stripped = stripHandoffTail(
      completion.text || "Nothing came back for that. Try again.",
      handoffKind,
    );
    holdback?.end(stripped.block !== null);
    let handoffCount = 0;
    if (stripped.block) {
      const { unmatchedQuotes } = await import("./quote-check");
      // A handoff quote gets no exemption from the quote promise.
      const verified = stripped.block.items.filter((item) =>
        quoteFields(stripped.block!.kind, item).every(
          (quote) => unmatchedQuotes(`"${quote}"`, assembled.quotable).length === 0,
        ),
      );
      handoffCount = verified.length;
      if (verified.length > 0) {
        const { writeHandoffs } = await import("./handoffs.server");
        await writeHandoffs(runId, preset.id, stripped.block.kind, verified);
      }
    } else if (stripped.parse === "malformed") {
      const { logHealth } = await import("./health.server");
      void logHealth({
        kind: "anomaly",
        surface: "analysis",
        orgId: profile.org_id,
        ownerId: target.ownerId,
        detail: "handoff_parse_failed",
        meta: { preset: preset.id },
      }).catch(() => undefined);
    }
    const { guardQuotes } = await import("./quote-guard.server");
    const guarded = await guardQuotes(
      stripped.prose || "Nothing came back for that. Try again.",
      assembled.quotable,
      cutOff,
      conversation,
      aiMeta,
    );
    const answer = cutOff ? `${guarded.answer}\n\n${CUT_OFF_NOTE}` : guarded.answer;

    // What this analysis actually read, recorded beside the answer.
    const manifest = {
      ...assembled.manifest,
      firm_checks_applied: firmCheckCount,
      ...(assembled.manifest.engagement
        ? {}
        : target.scopeType === "engagement"
          ? { engagement: { id: target.scopeId, name: target.title } }
          : {}),
    };

    const { data: written } = await supabase
      .from("chat_messages")
      .insert([
        { session_id: session.id, role: "user", content: preset.openingMessage },
        {
          session_id: session.id,
          role: "assistant",
          content: answer,
          context_manifest: manifest as unknown as never,
        },
      ])
      .select("id, role");
    const answerId = (written ?? []).find((row) => row.role === "assistant")?.id ?? null;

    const { recordAiReads } = await import("./ai-reads.server");
    await recordAiReads(assembled.reads, {
      surface: "ask_lasso",
      readerRole: isOwner ? "owner" : "coach",
      readerProfileId: profile.id,
      messageId: answerId,
    });

    const tokensIn = completion.tokensIn + guarded.tokensIn;
    const tokensOut = completion.tokensOut + guarded.tokensOut;
    const costUsd = Number((completion.costUsd + guarded.costUsd).toFixed(6));
    const itemsRead = assembled.sources.length;
    costSoFar = costUsd;
    itemsReadSoFar = itemsRead;
    claimsSoFar = guarded.claims;
    suppressedSoFar = guarded.suppressed;

    const { completeRun } = await import("./analysis-runs.server");
    await completeRun(runId, {
      items_read: itemsRead,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      cost_usd: costUsd,
      claims_rendered: guarded.claims,
      suppressed_claims: guarded.suppressed,
      context_manifest: manifest as unknown as never,
    });

    await recordEvent(supabase, {
      eventType: "analysis.run",
      orgId: profile.org_id,
      userId,
      dims: analysisRunDims({
        preset: preset.id,
        scopeType,
        status: "completed",
        itemsRead,
        costUsd,
        claims: guarded.claims,
        suppressed: guarded.suppressed,
      }),
    });

    await recordEvent(supabase, {
      eventType: "analysis.completed",
      orgId: profile.org_id,
      userId,
      dims: {
        preset: preset.id,
        items_read_bucket: smallBucket(itemsRead),
        suppressed_bucket: smallBucket(guarded.suppressed),
        cost_bucket: costBucket(costUsd),
        tokens_in_bucket: tokensBucket(tokensIn),
        handoffs_emitted: handoffsBucket(handoffCount),
        handoff_parse: stripped.parse,
      },
    });

    const { recordEventV2 } = await import("./telemetry-v2.server");
    await recordEventV2(supabase, userId, {
      eventName: "analysis.completed",
      props: {
        preset: preset.id,
        scope: scopeType,
        items_read: itemsRead,
        claims_rendered: guarded.claims,
        suppressed: guarded.suppressed,
        handoffs_emitted: handoffsBucket(handoffCount),
        handoff_parse: stripped.parse,
      },
      profileId: profile.id,
    });
    const { writeAnalysisFinding } = await import("./facts.server");
    void writeAnalysisFinding(
      { supabase, orgId: profile.org_id, profileId: profile.id },
      {
        analysisRunId: runId,
        presetId: preset.id,
        presetVersion: "v1",
        scope: scopeType,
        evidenceCount: itemsRead,
        model: completion.model ?? null,
      },
    ).catch(() => undefined);

    if (preset.id === "verification") {
      const { recordVerificationSignal } = await import("./verification-signal.server");
      void recordVerificationSignal(supabase, {
        userId,
        orgId: profile.org_id,
        profileId: profile.id,
        workItemId: target.scopeId,
        outputText: answer,
      }).catch(() => undefined);
    }

    return {
      run_id: runId,
      session_id: session.id,
      reused: false,
      items_read: itemsRead,
      suppressed: guarded.suppressed,
      claims: guarded.claims,
      manifest,
      answer,
    };
  } catch (e) {
    const message = (e as Error).message ?? "";
    return await fail(message.includes("too long") ? "timeout" : "model_error");
  }
}

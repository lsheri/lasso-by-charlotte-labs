import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ANALYSIS_PRESET_IDS, type AnalysisPresetId } from "@/lib/analysis-presets";

type StartInput = {
  preset_id: AnalysisPresetId;
  work_item_id: string;
  profile_id?: string | undefined;
};

export type AnalysisRunResult = {
  run_id: string;
  session_id: string;
  reused: boolean;
  items_read: number;
  suppressed: number;
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

/**
 * The one execution path every analysis runs through: a run row, a scoped
 * session, the preset prompt, the quote pipeline, then the run closed out with
 * real counts and cost. Adding an analysis is a registry entry, not a build.
 */
export const startAnalysis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: StartInput) => {
    if (!(ANALYSIS_PRESET_IDS as readonly string[]).includes(input.preset_id)) {
      throw new Error("Unknown analysis.");
    }
    if (!input.work_item_id) throw new Error("Nothing to analyse.");
    return input;
  })
  .handler(async ({ data, context }): Promise<AnalysisRunResult> => {
    const { supabase, userId } = context;

    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { analysisPreset } = await import("./analysis-presets");
    const preset = analysisPreset(data.preset_id);
    if (!preset) throw new Error("Unknown analysis.");

    const { data: item, error: itemError } = await supabase
      .from("work_items")
      .select("id, title, owner_id")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (itemError) throw new Error(itemError.message);
    if (!item) throw new Error("That item is gone.");
    const isOwner = item.owner_id === profile.id;
    if (!isOwner && !preset.coachMayRun) throw new Response("Forbidden", { status: 403 });

    const idempotencyKey = `${preset.id}:thread:${item.id}:${profile.id}`;

    // A second run while one is in flight returns the run already going.
    const { data: inFlight } = await supabase
      .from("analysis_runs")
      .select("id, session_id, items_read, suppressed_claims")
      .eq("idempotency_key", idempotencyKey)
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (inFlight?.session_id) {
      return {
        run_id: inFlight.id,
        session_id: inFlight.session_id,
        reused: true,
        items_read: inFlight.items_read ?? 1,
        suppressed: inFlight.suppressed_claims ?? 0,
      };
    }

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "analysis.started",
      orgId: profile.org_id,
      userId,
      dims: { preset: preset.id, scope_type: preset.scope },
    });

    const { data: session, error: sessionError } = await supabase
      .from("chat_sessions")
      .insert({
        profile_id: profile.id,
        org_id: profile.org_id,
        context_scope: { mode: "items", ids: [item.id] },
        title: `${preset.label}: ${item.title}`.slice(0, 120),
      })
      .select("id")
      .single();
    if (sessionError) throw new Error(sessionError.message);

    const { data: run, error: runError } = await supabase
      .from("analysis_runs")
      .insert({
        preset: preset.dbPreset,
        // analysis_runs.scope_type allows item | deliverable | engagement.
        scope_type: preset.scope === "thread" ? "item" : preset.scope,
        scope_id: item.id,
        idempotency_key: idempotencyKey,
        org_id: profile.org_id,
        owner_id: item.owner_id,
        run_by_profile_id: profile.id,
        session_id: session.id,
        status: "running",
      })
      .select("id")
      .single();
    if (runError || !run) throw new Error(runError?.message ?? "Could not start the analysis.");
    const runId = run.id;

    async function fail(reason: string): Promise<never> {
      await supabase
        .from("analysis_runs")
        .update({ status: "failed", error_class: reason, completed_at: new Date().toISOString() })
        .eq("id", runId);
      await recordEvent(supabase, {
        eventType: "analysis.failed",
        orgId: profile!.org_id,
        userId,
        dims: { preset: preset!.id, reason_class: reason },
      });
      throw new Error(
        reason === "timeout"
          ? "That took too long to finish. Try again."
          : "That analysis could not be completed.",
      );
    }

    try {
      const { assembleReflectContext } = await import("./reflect-context.server");
      const assembled = await assembleReflectContext(
        supabase,
        profile.id,
        { mode: "items", ids: [item.id] },
        { ownerProfileId: item.owner_id, readerRole: isOwner ? "owner" : "coach" },
      );

      const { REFLECT_SYSTEM_PROMPT } = await import("./reflect-shared");
      const conversation = [
        { role: "system" as const, content: REFLECT_SYSTEM_PROMPT },
        { role: "system" as const, content: preset.systemPrompt },
        {
          role: "system" as const,
          content: `THE CONVERSATION UNDER ANALYSIS:\n\n${assembled.context}`,
        },
        { role: "user" as const, content: preset.openingMessage },
      ];

      const { chatComplete, estimateCostUsd } = await import("./ai-gateway.server");
      const completion = await chatComplete(conversation, { timeoutMs: 180_000 });
      const cutOff = completion.finishReason === "length";
      const { CUT_OFF_NOTE } = await import("./quote-check");
      const { guardQuotes } = await import("./quote-guard.server");
      const guarded = await guardQuotes(
        completion.text || "Nothing came back for that. Try again.",
        assembled.context,
        cutOff,
        conversation,
      );
      const answer = cutOff ? `${guarded.answer}\n\n${CUT_OFF_NOTE}` : guarded.answer;

      const { data: written } = await supabase
        .from("chat_messages")
        .insert([
          { session_id: session.id, role: "user", content: preset.openingMessage },
          { session_id: session.id, role: "assistant", content: answer },
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
      const costUsd = estimateCostUsd(tokensIn, tokensOut);
      const itemsRead = assembled.sources.length;

      await supabase
        .from("analysis_runs")
        .update({
          items_read: itemsRead,
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          cost_usd: costUsd,
          claims_rendered: guarded.claims,
          suppressed_claims: guarded.suppressed,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);

      await recordEvent(supabase, {
        eventType: "analysis.completed",
        orgId: profile.org_id,
        userId,
        dims: {
          preset: preset.id,
          items_read_bucket: smallBucket(itemsRead),
          suppressed_bucket: smallBucket(guarded.suppressed),
          cost_bucket: costBucket(costUsd),
        },
      });

      return {
        run_id: runId,
        session_id: session.id,
        reused: false,
        items_read: itemsRead,
        suppressed: guarded.suppressed,
      };
    } catch (e) {
      const message = (e as Error).message ?? "";
      return await fail(message.includes("too long") ? "timeout" : "model_error");
    }
  });
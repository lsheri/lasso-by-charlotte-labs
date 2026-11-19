import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RedPenResult } from "@/lib/red-pen-shared";

type ItemInput = { item_id: string; profile_id?: string | null | undefined };

function validate(input: ItemInput): ItemInput {
  const itemId = typeof input?.item_id === "string" ? input.item_id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new Error("Unknown deliverable.");
  return { item_id: itemId, profile_id: input?.profile_id ?? null };
}

/** Owners and editors of the deliverable's board in a company workspace; never coaches or guests. */
async function gate(context: { supabase: Parameters<typeof import("./firm-corpus.server").requireFirmMember>[0]; userId: string }, data: ItemInput) {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
  const { engagementForItem } = await import("./span-audit.server");
  const engagementId = await engagementForItem(context.supabase, data.item_id);
  if (!engagementId) throw new Response("Not found", { status: 404 });
  const { isEngagementEditor } = await import("./canvas-lab.server");
  if (!(await isEngagementEditor(context.supabase, engagementId, profile.id))) throw new Response("Forbidden", { status: 403 });
  return { profile, engagementId };
}

/**
 * 17 Nov, firm brain PR 6: run the red pen on one deliverable. Reads the board's other items with the person's own
 * access, checks every claim, and keeps the result as one red_pen analysis run so reopening shows it.
 */
export const runRedPenFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<RedPenResult> => {
    const { profile, engagementId } = await gate(context, data);
    const { loadSpanScope } = await import("./span-audit.server");
    const scope = await loadSpanScope(context.supabase, data.item_id, profile.id);
    const { chatComplete, resolveAiMeta, AiError } = await import("./ai.server");
    const { createRun, completeRun, failRun } = await import("./analysis-runs.server");
    const meta = await resolveAiMeta(context.supabase as never, { surface: "red_pen", orgId: profile.org_id, profileId: profile.id, userId: context.userId });
    const run = await createRun({
      preset: "red_pen",
      scope_type: "deliverable",
      scope_id: data.item_id,
      idempotency_key: null,
      org_id: profile.org_id,
      owner_id: profile.id,
      run_by_profile_id: profile.id,
      session_id: null,
    });
    const { runRedPen } = await import("./red-pen.server");
    let outcome;
    try {
      outcome = await runRedPen(chatComplete, { itemId: data.item_id, anchorTitle: scope.anchorTitle, anchorText: scope.anchorText, upstream: scope.upstream, meta });
    } catch (error) {
      await failRun(run.id, error instanceof AiError ? error.errorClass : "model_error").catch(() => {});
      throw error;
    }
    const { result, usage } = outcome;
    await completeRun(run.id, {
      items_read: result.sourcesRead,
      tokens_in: usage.tokensIn,
      tokens_out: usage.tokensOut,
      cost_usd: usage.costUsd,
      claims_rendered: result.claims.length,
      suppressed_claims: 0,
      handoffs: { red_pen: result } as never,
      context_manifest: null,
    });

    // 19 Nov, proposal ledger: a finished run on a proposal deliverable of a proposal board writes one red_pen_run
    // row, counted from the stored grades. Detached: a ledger failure never fails the run.
    await (async () => {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { ledgerAfterRedPen } = await import("./proposal-ledger.server");
      await ledgerAfterRedPen({ userDb: context.supabase, admin: supabaseAdmin as unknown as typeof context.supabase, profile }, { engagementId, itemId: data.item_id, runId: run.id, claims: result.claims });
    })().catch(() => {});

    const { recordEvent } = await import("./telemetry.server");
    const { bucket } = await import("./telemetry-shared");
    await recordEvent(context.supabase, {
      eventType: "red_pen.ran",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { claims: bucket(result.claims.length), unsupported: bucket(result.counts.unsupported), weak: bucket(result.counts.weak) },
    });
    return result;
  });

/** The last red pen result for a deliverable, or null. Same gate as running it. */
export const latestRedPen = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<RedPenResult | null> => {
    const { profile } = await gate(context, data);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("analysis_runs")
      .select("handoffs")
      .eq("preset", "red_pen")
      .eq("scope_type", "deliverable")
      .eq("scope_id", data.item_id)
      .eq("org_id", profile.org_id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const handoffs = (row?.handoffs ?? null) as { red_pen?: RedPenResult } | null;
    return handoffs?.red_pen ?? null;
  });

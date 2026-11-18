import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SowTerms } from "@/lib/sow-terms-shared";

type ItemInput = { item_id: string; profile_id?: string | null | undefined };
type SaveInput = ItemInput & { fee_text: string; weeks: string; clear: boolean };

/** How much of a SOW the suggestion reads. Fee and length sit near the top of every SOW the firm writes. */
const SUGGEST_CHARS = 30_000;

const SUGGEST_SYSTEM = [
  "You read one statement of work and return its fee and length exactly as written.",
  'Return JSON: {"fee_text": string, "weeks": number | null}.',
  "fee_text: the total or monthly fee copied word for word from the document, with its currency mark, for example \"$380k\" or \"£45,000 per month\". Empty string when the document states no single fee.",
  "weeks: the length in weeks only when the document states it in weeks. Otherwise null. Never convert months or dates.",
  "Copy, never compute. No other keys.",
].join("\n");

function validateItem(input: ItemInput): ItemInput {
  const itemId = typeof input?.item_id === "string" ? input.item_id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new Error("Unknown document.");
  return { item_id: itemId, profile_id: input?.profile_id ?? null };
}

function validateSave(input: SaveInput): SaveInput {
  const base = validateItem(input);
  return {
    ...base,
    fee_text: typeof input?.fee_text === "string" ? input.fee_text : "",
    weeks: typeof input?.weeks === "string" ? input.weeks : "",
    clear: input?.clear === true,
  };
}

/**
 * Admins and leads of a company workspace, on a deliverable in their own workspace that sits on a board. The admin
 * client reads and writes behind this gate because a lead may set terms on a SOW someone else captured.
 */
async function gate(context: { supabase: Parameters<typeof import("./firm-corpus.server").requireFirmMember>[0]; userId: string }, data: ItemInput) {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, data.profile_id);
  const { canSetFees } = await import("./sow-terms-shared");
  if (!canSetFees(profile.role)) throw new Response("Forbidden", { status: 403 });
  const { AUDIT_ITEM_COLUMNS, engagementForItem } = await import("./span-audit.server");
  const { data: row } = await supabaseAdmin.from("work_items").select(AUDIT_ITEM_COLUMNS).eq("id", data.item_id).maybeSingle();
  const item = row as unknown as Record<string, unknown> | null;
  if (!item || item["org_id"] !== profile.org_id) throw new Response("Not found", { status: 404 });
  const { canMarkShown } = await import("./client-showings-shared");
  if (!canMarkShown(item["type"] as string)) throw new Response("Fee terms go on a document.", { status: 400 });
  if (!(await engagementForItem(supabaseAdmin, data.item_id))) throw new Response("Put the SOW on a board first.", { status: 400 });
  return { profile, admin: supabaseAdmin, item };
}

/** The SOW's current terms, for admins and leads only. */
export const readSowTermsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateItem)
  .handler(async ({ data, context }): Promise<SowTerms | null> => {
    const { item } = await gate(context, data);
    const { sowTermsOf } = await import("./sow-terms-shared");
    return sowTermsOf(item["meta"]);
  });

/** One fast-tier read of the SOW. Code keeps only a fee and length found word for word; nothing is saved. */
export const suggestSowTermsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateItem)
  .handler(async ({ data, context }): Promise<{ feeText: string; weeks: string }> => {
    const { profile, admin, item } = await gate(context, data);
    const { loadAuditItem } = await import("./span-audit.server");
    const loaded = await loadAuditItem(admin, item);
    const text = (loaded.text ?? "").slice(0, SUGGEST_CHARS);
    const { checkSuggestion } = await import("./sow-terms-shared");
    let suggestion = { feeText: "", weeks: "" };
    if (text.trim()) {
      const { chatComplete, resolveAiMeta } = await import("./ai.server");
      const meta = await resolveAiMeta(context.supabase as never, { surface: "sow_terms", orgId: profile.org_id, profileId: profile.id, userId: context.userId });
      const result = await chatComplete(
        [
          { role: "system", content: SUGGEST_SYSTEM },
          { role: "user", content: `SOW: ${loaded.title}\n\n${text}` },
        ],
        { tier: "fast", maxTokens: 300, responseFormat: { type: "json_object" }, meta },
      );
      const { parseJsonObject } = await import("./span-provenance.server");
      suggestion = checkSuggestion(text, parseJsonObject(result.text));
    }
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "sow_terms.suggested",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { fee: suggestion.feeText ? "found" : "none", weeks: suggestion.weeks ? "found" : "none" },
    });
    return suggestion;
  });

/** Saves what the person confirmed, or removes the terms. Nothing a model wrote is stored without this call. */
export const saveSowTermsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSave)
  .handler(async ({ data, context }): Promise<SowTerms | null> => {
    const { profile, admin, item } = await gate(context, data);
    const { buildSowTerms, validateSowTerms } = await import("./sow-terms-shared");
    const meta = { ...((item["meta"] ?? {}) as Record<string, unknown>) };
    let terms: SowTerms | null = null;
    if (data.clear) {
      delete meta["sow_facts"];
    } else {
      const problem = validateSowTerms({ feeText: data.fee_text, weeks: data.weeks });
      if (problem) throw new Response(problem, { status: 400 });
      terms = buildSowTerms({ feeText: data.fee_text, weeks: data.weeks }, profile.id);
      meta["sow_facts"] = terms;
    }
    const { error } = await admin.from("work_items").update({ meta: meta as never }).eq("id", data.item_id).eq("org_id", profile.org_id);
    if (error) throw new Response("Could not save.", { status: 500 });
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: "sow_terms.saved",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { action: data.clear ? "cleared" : "saved", basis: terms?.fee_basis ?? "text" },
    });
    return terms;
  });

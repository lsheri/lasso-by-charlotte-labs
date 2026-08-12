import { createClient } from "@supabase/supabase-js";
import { assembleReflectContext } from "@/lib/reflect-context.server";
import { chatComplete, estimateCostUsd } from "@/lib/ai-gateway.server";
import { guardQuotes } from "@/lib/quote-guard.server";
import { REFLECT_SYSTEM_PROMPT } from "@/lib/reflect-shared";
import { analysisPreset } from "@/lib/analysis-presets";

const supabase: any = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function go(presetId: string, itemId: string, ownerId: string, orgId: string) {
  const preset = analysisPreset(presetId)!;
  const { data: session } = await supabase.from("chat_sessions").insert({ profile_id: ownerId, org_id: orgId, context_scope: { mode: "items", ids: [itemId] }, title: `${preset.label} verify` }).select("id").single();
  const { data: run, error: re } = await supabase.from("analysis_runs").insert({ preset: preset.dbPreset, scope_type: preset.scope === "thread" ? "item" : preset.scope, scope_id: itemId, idempotency_key: `${preset.id}:thread:${itemId}:${ownerId}:verify`, org_id: orgId, owner_id: ownerId, run_by_profile_id: ownerId, session_id: session.id, status: "running" }).select("id").single();
  if (re) throw re;
  const assembled = await assembleReflectContext(supabase, ownerId, { mode: "items", ids: [itemId] }, { ownerProfileId: ownerId, readerRole: "owner" });
  const conversation = [
    { role: "system" as const, content: REFLECT_SYSTEM_PROMPT },
    { role: "system" as const, content: preset.systemPrompt },
    { role: "system" as const, content: `THE CONVERSATION UNDER ANALYSIS:\n\n${assembled.context}` },
    { role: "user" as const, content: preset.openingMessage },
  ];
  const c = await chatComplete(conversation, { timeoutMs: 300000 });
  const g = await guardQuotes(c.text, assembled.context, c.finishReason === "length", conversation);
  const tokensIn = c.tokensIn + g.tokensIn, tokensOut = c.tokensOut + g.tokensOut;
  const cost = estimateCostUsd(tokensIn, tokensOut);
  await supabase.from("chat_messages").insert([{ session_id: session.id, role: "user", content: preset.openingMessage }, { session_id: session.id, role: "assistant", content: g.answer }]);
  await supabase.from("analysis_runs").update({ items_read: assembled.sources.length, tokens_in: tokensIn, tokens_out: tokensOut, cost_usd: cost, claims_rendered: g.claims, suppressed_claims: g.suppressed, status: "completed", completed_at: new Date().toISOString() }).eq("id", run.id);
  console.log(`\n\n===== ${preset.label} :: ${itemId} =====`);
  console.log(`finish=${c.finishReason} tokens_in=${tokensIn} tokens_out=${tokensOut} cost_usd=${cost} unmatched_before=${g.unmatchedBefore} repairs=${g.repairs} suppressed=${g.suppressed} claims=${g.claims}`);
  console.log("-----");
  console.log(g.answer);
}

const [preset, item, owner, org] = process.argv.slice(2);
await go(preset, item, owner, org);

import type { ChainMethod } from "./subjects-shared";

/**
 * Pass 167. A chain link is only written when the relationship is KNOWN.
 *
 * 'same_conversation' consecutive turns of one pushed conversation, in order.
 * 'explicit_reference' the push payload itself names a prior item. Nothing
 *   sends that today, so nothing writes it today.
 * 'user_linked' a person said so.
 *
 * Prose, titles and timing proximity never reach this module.
 */

type Pair = { from_turn: string; to_turn: string; method: ChainMethod };

async function insertMissing(pairs: Pair[]): Promise<number> {
  if (pairs.length === 0) return 0;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const fromIds = Array.from(new Set(pairs.map((p) => p.from_turn)));
  const { data: existing } = await supabaseAdmin
    .from("chain_links")
    .select("from_turn, to_turn")
    .in("from_turn", fromIds);
  const seen = new Set((existing ?? []).map((r) => `${r.from_turn}:${r.to_turn}`));
  const rows = pairs.filter((p) => !seen.has(`${p.from_turn}:${p.to_turn}`));
  if (rows.length === 0) return 0;
  const { error } = await supabaseAdmin.from("chain_links").insert(rows);
  if (error) {
    console.error("[chain-links] insert failed:", error.message);
    return 0;
  }
  return rows.length;
}

/**
 * The turns of one pushed conversation, in the order they were stored. Safe to
 * run again: a pair that already exists is left alone.
 */
export async function recordSameConversationChain(workItemId: string): Promise<number> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: turns } = await supabaseAdmin
      .from("turns")
      .select("id, turn_no")
      .eq("work_item_id", workItemId)
      .order("turn_no", { ascending: true });
    const ordered = turns ?? [];
    if (ordered.length < 2) return 0;
    const pairs: Pair[] = [];
    for (let i = 1; i < ordered.length; i += 1) {
      pairs.push({
        from_turn: ordered[i - 1]!.id,
        to_turn: ordered[i]!.id,
        method: "same_conversation",
      });
    }
    return await insertMissing(pairs);
  } catch (e) {
    console.error("[chain-links] same_conversation failed:", (e as Error).message);
    return 0;
  }
}

/**
 * A person joined two pieces of their own work. The edge runs from the last
 * turn of the earlier one to the first turn of the later one. Both ends must
 * have turns, otherwise there is nothing truthful to point at and we say so.
 */
export async function recordUserLinkedChain(
  fromItemId: string,
  toItemId: string,
): Promise<{ written: number; reason?: "no_turns" }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: fromTurn } = await supabaseAdmin
    .from("turns")
    .select("id")
    .eq("work_item_id", fromItemId)
    .order("turn_no", { ascending: false })
    .limit(1)
    .maybeSingle();
  const { data: toTurn } = await supabaseAdmin
    .from("turns")
    .select("id")
    .eq("work_item_id", toItemId)
    .order("turn_no", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (!fromTurn || !toTurn) return { written: 0, reason: "no_turns" };
  const written = await insertMissing([
    { from_turn: fromTurn.id, to_turn: toTurn.id, method: "user_linked" },
  ]);
  return { written };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import { feesOf, metaWithFees, termsWithoutFees, type FeeFields } from "./sow-terms-shared";

/**
 * F2 (QA of PR 273, 20 Nov): SOW fee figures live in public.work_item_fee_terms, which has row security on and no
 * policy for signed-in people, so only the server (service role) can read it. work_items.meta.sow_facts keeps the
 * length, the basis and who confirmed it, never the money, so a member's own reads of work_items carry no fee.
 *
 * Until Liam pastes the table's SQL, the table is missing: reads find nothing and writes keep the old place (meta), so
 * nothing breaks before or after the paste.
 */
export const FEE_TERMS_TABLE = "work_item_fee_terms";

// The table is not in the generated types until after the paste.
type Loose = { from: (table: string) => any };

function missingTable(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  return error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");
}

/** Fees for these items, from the protected table. Server only; call after the caller's role is checked. */
export async function readFeeTerms(admin: SupabaseClient<any>, itemIds: readonly string[]): Promise<Map<string, FeeFields>> {
  const out = new Map<string, FeeFields>();
  const ids = [...new Set(itemIds)];
  for (let start = 0; start < ids.length; start += 100) {
    const page = ids.slice(start, start + 100);
    const { data, error } = await (admin as unknown as Loose).from(FEE_TERMS_TABLE).select("work_item_id, fee_text, fee_amount").in("work_item_id", page);
    if (missingTable(error)) return out;
    if (error) throw new Error(error.message);
    for (const row of (data ?? []) as { work_item_id: string; fee_text: string; fee_amount: number | null }[]) {
      out.set(row.work_item_id, { fee_text: row.fee_text, fee_amount: row.fee_amount === null ? null : Number(row.fee_amount) });
    }
  }
  return out;
}

/** The items with their fees put back into meta, for server code that already decided the reader may see fees. */
export async function withFeeTerms<T extends { id: string; meta: unknown }>(admin: SupabaseClient<any>, items: readonly T[]): Promise<T[]> {
  const sowIds = items.filter((item) => hasSowFacts(item.meta)).map((item) => item.id);
  if (!sowIds.length) return [...items];
  const fees = await readFeeTerms(admin, sowIds);
  return items.map((item) => (fees.has(item.id) ? { ...item, meta: metaWithFees(item.meta, fees.get(item.id)) } : item));
}

function hasSowFacts(meta: unknown): boolean {
  const facts = meta && typeof meta === "object" ? (meta as Record<string, unknown>)["sow_facts"] : null;
  return Boolean(facts && typeof facts === "object");
}

/**
 * The meta to save for a SOW and where its fee goes. With the table in place the fee goes there and meta keeps none;
 * without it (before the paste) meta keeps the fee as before. `facts` null clears the terms and the fee.
 */
export async function storeSowTerms(
  admin: SupabaseClient<any>,
  input: { itemId: string; orgId: string; meta: Record<string, unknown>; facts: Record<string, unknown> | null },
): Promise<Record<string, unknown>> {
  const meta = { ...input.meta };
  const table = (admin as unknown as Loose).from(FEE_TERMS_TABLE);
  if (!input.facts) {
    delete meta["sow_facts"];
    const { error } = await table.delete().eq("work_item_id", input.itemId);
    if (error && !missingTable(error)) throw new Error(error.message);
    return meta;
  }
  const fees = feesOf(input.facts);
  if (!fees) {
    meta["sow_facts"] = input.facts;
    return meta;
  }
  const { error } = await table.upsert(
    { work_item_id: input.itemId, org_id: input.orgId, fee_text: fees.fee_text, fee_amount: fees.fee_amount, updated_at: new Date().toISOString() },
    { onConflict: "work_item_id" },
  );
  if (missingTable(error)) {
    meta["sow_facts"] = input.facts;
    return meta;
  }
  if (error) throw new Error(error.message);
  meta["sow_facts"] = termsWithoutFees(input.facts);
  return meta;
}

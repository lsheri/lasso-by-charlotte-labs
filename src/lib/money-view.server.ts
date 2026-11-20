import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { resolveProfile } from "@/lib/profile-resolve";

import { isSowItem, moneyFreeText, seesMoney } from "./money-mask-shared";

/**
 * D-91: does this caller read money on an item? Admins and leads of the item's own workspace do; Members (em),
 * coaches, guests and anyone without an active profile there do not. Only SOW items are masked, so everything else
 * reads exactly as before.
 */
export type MoneyView = { mask: boolean };

type SowShape = { org_id?: string | null; type?: string | null; title?: string | null; meta?: unknown };

export async function moneyViewFor(supabase: SupabaseClient<Database>, userId: string, item: SowShape): Promise<MoneyView> {
  if (!isSowItem(item)) return { mask: false };
  if (!item.org_id) return { mask: true };
  const profile = await resolveProfile(supabase, userId, null, item.org_id).catch(() => null);
  return { mask: !seesMoney(profile?.role) };
}

/** The text as this view may read it. */
export function viewText<T extends string | null | undefined>(view: MoneyView, text: T): T {
  return view.mask && typeof text === "string" ? (moneyFreeText(text) as T) : text;
}

/**
 * The money-free summary of every SOW among rows the caller has already read under their own policies, keyed by item
 * id. Read with the server client, because the SQL floor keeps a Member's own session from reading a SOW's extract.
 */
export async function sowSummariesForMember(rows: readonly { id: string; type?: string | null; title?: string | null; meta?: unknown }[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.filter((row) => isSowItem(row)).map((row) => row.id))];
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("work_item_extracts").select("work_item_id, summary").in("work_item_id", ids);
  for (const row of data ?? []) if (row.summary) out.set(row.work_item_id, moneyFreeText(row.summary));
  return out;
}

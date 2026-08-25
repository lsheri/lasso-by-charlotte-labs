/**
 * Removing one traced question. span_links carries no client write policies by
 * design, so the delete is made with the admin client only after the caller has
 * been shown, through their own reads, to own the anchor the question was asked
 * about. Exactly one row goes, and the work itself is untouched.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

export type CallerClient = SupabaseClient<Database>;

export const SPAN_LINK_NOT_AVAILABLE = "That traced question is not available to you.";

export type SpanDeleteResult = { deleted: number; from_item_id: string };

export async function deleteSpanLinkRow(
  caller: CallerClient,
  admin: CallerClient,
  input: { spanLinkId: string; profileId: string },
): Promise<SpanDeleteResult> {
  const link = await caller
    .from("span_links")
    .select("id, from_item_id")
    .eq("id", input.spanLinkId)
    .maybeSingle();
  if (link.error) throw new Error(link.error.message);
  const row = link.data as { id: string; from_item_id: string } | null;
  if (!row) throw new Error(SPAN_LINK_NOT_AVAILABLE);

  const anchor = await caller
    .from("work_items")
    .select("id, owner_id")
    .eq("id", row.from_item_id)
    .maybeSingle();
  if (anchor.error) throw new Error(anchor.error.message);
  const item = anchor.data as { id: string; owner_id: string } | null;
  if (!item) throw new Error(SPAN_LINK_NOT_AVAILABLE);
  if (item.owner_id !== input.profileId) throw new Response("Forbidden", { status: 403 });

  const removed = await admin.from("span_links").delete().eq("id", row.id);
  if (removed.error) throw new Error(removed.error.message);
  return { deleted: 1, from_item_id: row.from_item_id };
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { isOutputKind, type OutputKind } from "./declared-work";
import { recordEvent } from "./telemetry.server";
import { isJourneyBands, journeyBands } from "./work-journey";
import { vendorFromSource } from "./work-taxonomy";

/**
 * Pass 153: workitem.journey, emitted once per item at the ship moment,
 * alongside artifact.declared. Bands only, computed from links that already
 * exist. A linkage we cannot resolve lands in the lowest bucket.
 */

type Actor = {
  orgId: string;
  userId: string | null | undefined;
  profileId?: string | null | undefined;
};

type Ctx = {
  workItemId: string;
  outputKind: OutputKind;
  shippedAt?: Date | string | null | undefined;
};

type LinkedItem = {
  id: string;
  type: string | null;
  source: string | null;
  source_vendor: string | null;
  source_meta: unknown;
  captured_at: string | null;
  created_at_source: string | null;
};

async function linkedConversations(
  supabase: SupabaseClient<Database>,
  workItemId: string,
): Promise<LinkedItem[]> {
  const { data: links } = await supabase
    .from("work_item_links")
    .select("from_item_id, to_item_id")
    .or(`from_item_id.eq.${workItemId},to_item_id.eq.${workItemId}`);

  const ids = new Set<string>();
  for (const link of links ?? []) {
    if (link.from_item_id && link.from_item_id !== workItemId) ids.add(link.from_item_id);
    if (link.to_item_id && link.to_item_id !== workItemId) ids.add(link.to_item_id);
  }
  if (ids.size === 0) return [];

  const { data: items } = await supabase
    .from("work_items")
    .select("id, type, source, source_vendor, source_meta, captured_at, created_at_source")
    .in("id", [...ids].slice(0, 200));

  return ((items ?? []) as LinkedItem[]).filter((item) => item.type === "ai_thread");
}

export async function noteWorkJourney(
  supabase: SupabaseClient<Database>,
  actor: Actor,
  ctx: Ctx,
): Promise<void> {
  if (!isOutputKind(ctx.outputKind)) throw new Error("output_kind is not one of the choices");

  const conversations = await linkedConversations(supabase, ctx.workItemId);

  let totalTurns = 0;
  if (conversations.length > 0) {
    const { count } = await supabase
      .from("turns")
      .select("id", { count: "exact", head: true })
      .in(
        "work_item_id",
        conversations.map((c) => c.id),
      );
    totalTurns = count ?? 0;
  }

  const vendors = new Set<string>();
  for (const conversation of conversations) {
    const vendor = vendorFromSource({
      source: conversation.source,
      source_vendor: conversation.source_vendor,
      source_meta: (conversation.source_meta ?? null) as { vendor?: string | null } | null,
    });
    if (vendor !== "unknown") vendors.add(vendor);
  }

  const stamps = conversations
    .map((c) => c.created_at_source ?? c.captured_at)
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time));

  let earliest: number | null = stamps.length > 0 ? Math.min(...stamps) : null;
  if (earliest === null) {
    const { data: item } = await supabase
      .from("work_items")
      .select("captured_at, created_at_source")
      .eq("id", ctx.workItemId)
      .maybeSingle();
    const own = item?.created_at_source ?? item?.captured_at ?? null;
    const time = own ? new Date(own).getTime() : NaN;
    earliest = Number.isFinite(time) ? time : null;
  }

  const shipped = ctx.shippedAt ? new Date(ctx.shippedAt) : new Date();
  const bands = journeyBands({
    threads: conversations.length,
    totalTurns,
    toolCount: vendors.size,
    earliestAt: earliest,
    shippedAt: shipped,
  });
  if (!isJourneyBands(bands)) throw new Error("journey bands fell outside the vocabulary");

  await recordEvent(supabase, {
    eventType: "workitem.journey",
    orgId: actor.orgId,
    userId: actor.userId,
    profileId: actor.profileId ?? null,
    dims: { ...bands, output_kind: ctx.outputKind },
  });
}

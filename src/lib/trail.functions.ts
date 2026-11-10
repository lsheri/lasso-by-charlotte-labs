import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import { boardLinksToWork, buildTrail, type Trail, type TrailBoardLink, type TrailItem } from "@/lib/trail-shared";

/**
 * TRAIL T1: the trail for one piece of work, read as the caller so row policies decide what is
 * readable. Three sources only (see trail-shared.ts): the piece it was made in or that was made in it,
 * work links a person confirmed, and arrows drawn on the board it is being read on. It does not read
 * the rest of the engagement, unreviewed drafts, or who drew an arrow.
 */
export const getTrail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { work_item_id: string; workboard_id?: string | undefined; profile_id?: string | undefined }) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return {
      work_item_id: input.work_item_id,
      workboard_id: input.workboard_id ?? null,
      profile_id: input.profile_id ?? null,
    };
  })
  .handler(async ({ data, context }): Promise<Trail> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: item } = await supabase
      .from("work_items")
      .select("id, owner_id, org_id, type, parent_work_item_id")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (!item) return { madeFrom: [], usedIn: [], leadsWith: "used" };
    const isOwner = item.owner_id === profile.id;

    const [{ data: org }, { data: children }, { data: workLinks }] = await Promise.all([
      supabase.from("orgs").select("vendor_display").eq("id", item.org_id).maybeSingle(),
      supabase.from("work_items").select("id").eq("parent_work_item_id", item.id),
      supabase
        .from("work_item_links")
        .select("from_item_id, to_item_id, relation, status, source, rationale")
        .or(`from_item_id.eq.${item.id},to_item_id.eq.${item.id}`)
        .eq("status", "confirmed"),
    ]);
    const vendorVisible = isOwner || org?.vendor_display !== "vendor_neutral";

    let boardLinks: TrailBoardLink[] = [];
    if (data.workboard_id) {
      const [{ data: nodes }, { data: links }] = await Promise.all([
        supabase
          .from("workboard_nodes")
          .select("id, work_item_id")
          .eq("workboard_id", data.workboard_id)
          .is("deleted_at", null),
        supabase
          .from("workboard_links")
          .select("from_node_id, to_node_id, relation")
          .eq("workboard_id", data.workboard_id)
          .is("deleted_at", null),
      ]);
      boardLinks = boardLinksToWork(nodes ?? [], links ?? []).filter(
        (link) => link.from_item_id === item.id || link.to_item_id === item.id,
      );
    }

    const ids = new Set<string>();
    if (item.parent_work_item_id) ids.add(item.parent_work_item_id);
    for (const child of children ?? []) ids.add(child.id);
    for (const link of workLinks ?? []) ids.add(link.from_item_id === item.id ? link.to_item_id : link.from_item_id);
    for (const link of boardLinks) ids.add(link.from_item_id === item.id ? link.to_item_id : link.from_item_id);
    ids.delete(item.id);

    const { data: rows } = ids.size
      ? await supabase
          .from("work_items")
          .select("id, title, type, source_vendor, work_date, created_at_source, captured_at")
          .in("id", [...ids])
      : { data: [] };
    // A piece the caller may not read never comes back from the query above, so it drops out here.
    const readable = new Map<string, TrailItem>(
      (rows ?? []).map((row) => [
        row.id,
        {
          id: row.id,
          title: row.title,
          type: row.type as string,
          source_vendor: vendorVisible ? row.source_vendor : null,
          date: row.work_date ?? row.created_at_source ?? row.captured_at ?? null,
        },
      ]),
    );

    return buildTrail({
      itemId: item.id,
      itemType: item.type as string,
      isOwner,
      parentId: item.parent_work_item_id,
      childIds: (children ?? []).map((child) => child.id),
      workLinks: workLinks ?? [],
      boardLinks,
      readable,
    });
  });

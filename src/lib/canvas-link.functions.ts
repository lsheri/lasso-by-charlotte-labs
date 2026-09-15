import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";

/**
 * Pass 196: a person drew a connection between two pieces of their own work.
 *
 * A drawn edge is an assertion, not a trace. It is written with
 * source: 'person', already confirmed, because the drawing IS the
 * confirmation and there is nothing left to answer.
 */
export const drawCanvasLinkFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      engagement_id: string;
      from_item_id: string;
      to_item_id: string;
      profile_id?: string | undefined;
    }) => ({
      engagement_id: typeof input?.engagement_id === "string" ? input.engagement_id : "",
      from_item_id: typeof input?.from_item_id === "string" ? input.from_item_id : "",
      to_item_id: typeof input?.to_item_id === "string" ? input.to_item_id : "",
      profile_id: input?.profile_id ?? null,
    }),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    if (!data.from_item_id || !data.to_item_id) return { ok: true };
    // A person cannot draw a line from a thing to itself.
    if (data.from_item_id === data.to_item_id) throw new Error("A piece of work cannot lead to itself.");

    // The request scoped client, never a service role one: row level security
    // is what enforces that only the owner may write this edge.
    const { supabase, userId } = context;

    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { ok: true };

    const { data: pair } = await supabase
      .from("work_items")
      .select("id, owner_id")
      .in("id", [data.from_item_id, data.to_item_id]);
    const rows = pair ?? [];
    const from = rows.find((row) => row.id === data.from_item_id);
    const to = rows.find((row) => row.id === data.to_item_id);
    // Someone may only connect their own work.
    if (!from || !to || from.owner_id !== profile.id || to.owner_id !== profile.id) {
      throw new Response("Forbidden", { status: 403 });
    }

    // One relation in this pass, decided here and never accepted from the client.
    const relation = "informed";
    const now = new Date().toISOString();

    // Source is written once, on creation, and never rewritten afterwards,
    // because it records who first asserted the edge and that fact does not change.
    const { data: existing } = await supabase
      .from("work_item_links")
      .select("id, status, source")
      .eq("from_item_id", data.from_item_id)
      .eq("to_item_id", data.to_item_id)
      .eq("relation", relation)
      .maybeSingle();

    if (!existing) {
      // No row exists: the person is the first to assert this pair.
      const { error } = await supabase.from("work_item_links").insert({
        from_item_id: data.from_item_id,
        to_item_id: data.to_item_id,
        relation,
        source: "person",
        status: "confirmed",
        confirmed_at: now,
        owner_id: profile.id,
        org_id: profile.org_id,
      });
      if (error) throw new Error("That did not save.");
    } else if (existing.status !== "discarded") {
      // The pair is already asserted and active; nothing changes.
      return { ok: true };
    } else {
      // The pair was discarded. Reviving it only restores confirmation; it does
      // NOT rewrite source, owner_id or org_id, because those were decided at creation.
      const { error } = await supabase
        .from("work_item_links")
        .update({ status: "confirmed", confirmed_at: now })
        .eq("id", existing.id);
      if (error) throw new Error("That did not save.");
    }

    try {
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabase, {
        eventType: "link.drawn",
        orgId: profile.org_id,
        userId,
        profileId: profile.id,
        dims: { relation },
      });
    } catch {
      // Drawing a connection must never fail because recording it failed.
    }

    // Deliberately no v2 record and no lineage.confirmed here. That metric
    // measures whether the model was right about a pair it proposed. An edge
    // the model never proposed must never land in it. Do not "fix" this.
    return { ok: true };
  });

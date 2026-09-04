import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { resolveProfile } from "./profile-resolve";
import { entityKey, splitEntities } from "./entity-key";
import {
  CURATE_ACTIONS,
  sortSubjects,
  type CurateAction,
  type HandoffSuggestion,
  type Subject,
} from "./subjects-shared";

/**
 * Pass 167. Subjects come from what the extract already read. Nothing here
 * guesses, merges by itself, or ranks a person's subjects.
 */

async function ownItemIds(
  supabase: Parameters<typeof resolveProfile>[0],
  ownerId: string,
): Promise<string[]> {
  const { data } = await supabase.from("work_items").select("id").eq("owner_id", ownerId);
  return (data ?? []).map((row) => row.id);
}

export const listSubjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined } | undefined) => ({
    profile_id: input?.profile_id ?? null,
  }))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ subjects: Subject[]; suggestions: HandoffSuggestion[] }> => {
      const { supabase, userId } = context;
      const profile = await resolveProfile(supabase, userId, data.profile_id);
      if (!profile) throw new Response("Forbidden", { status: 403 });

      const { data: rows } = await supabase
        .from("work_item_entities")
        .select("entity_raw, entity_key, source, merged_into")
        .eq("owner_id", profile.id);

      const byKey = new Map<string, Subject>();
      for (const row of rows ?? []) {
        const existing = byKey.get(row.entity_key);
        const next: Subject = {
          entity_key: row.entity_key,
          entity_raw: row.entity_raw,
          source: (row.source as Subject["source"]) ?? "extract",
          merged_into: row.merged_into,
        };
        // A key a person has settled wins over an untouched copy of itself.
        if (!existing || existing.source === "extract") byKey.set(row.entity_key, next);
      }

      const itemIds = await ownItemIds(supabase, profile.id);
      let suggestions: HandoffSuggestion[] = [];
      if (itemIds.length > 0) {
        const { data: extracts } = await supabase
          .from("work_item_extracts")
          .select("work_item_id, handoff")
          .in("work_item_id", itemIds)
          .not("handoff", "is", null);
        const withProse = (extracts ?? []).filter((e) => (e.handoff ?? "").trim().length > 0);
        if (withProse.length > 0) {
          const { data: items } = await supabase
            .from("work_items")
            .select("id, title")
            .in(
              "id",
              withProse.map((e) => e.work_item_id),
            );
          const titles = new Map((items ?? []).map((i) => [i.id, i.title]));
          suggestions = withProse.map((e) => ({
            work_item_id: e.work_item_id,
            title: titles.get(e.work_item_id) ?? "Untitled",
            handoff: (e.handoff ?? "").trim().slice(0, 400),
          }));
        }
      }

      return { subjects: sortSubjects(Array.from(byKey.values())), suggestions };
    },
  );

/**
 * Read the subjects out of your own extracts into the subject list. Safe to
 * run again: the unique index means a repeat writes nothing new.
 */
export const populateSubjects = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined } | undefined) => ({
    profile_id: input?.profile_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<{ added: number; read: number }> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const itemIds = await ownItemIds(supabase, profile.id);
    if (itemIds.length === 0) return { added: 0, read: 0 };

    const { data: extracts } = await supabase
      .from("work_item_extracts")
      .select("work_item_id, entities")
      .in("work_item_id", itemIds);

    const rows: {
      work_item_id: string;
      org_id: string;
      owner_id: string;
      entity_raw: string;
      entity_key: string;
      source: string;
    }[] = [];
    for (const extract of extracts ?? []) {
      for (const raw of splitEntities(extract.entities)) {
        const key = entityKey(raw);
        if (!key) continue;
        rows.push({
          work_item_id: extract.work_item_id,
          org_id: profile.org_id,
          owner_id: profile.id,
          entity_raw: raw,
          entity_key: key,
          source: "extract",
        });
      }
    }
    if (rows.length === 0) return { added: 0, read: 0 };

    const { data: inserted, error } = await supabase
      .from("work_item_entities")
      .upsert(rows, { onConflict: "work_item_id,entity_key", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    return { added: (inserted ?? []).length, read: rows.length };
  });

/**
 * Confirm, reject, fold into another subject, or undo a fold. Every action is
 * the owner's, and folding is always reversible.
 */
export const curateSubject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      entity_key: string;
      action: CurateAction;
      merge_into?: string | undefined;
      profile_id?: string | undefined;
    }) => {
      const key = typeof input?.entity_key === "string" ? input.entity_key : "";
      if (!key) throw new Error("entity_key is required");
      if (!(CURATE_ACTIONS as readonly string[]).includes(input?.action)) {
        throw new Error("Unsupported action");
      }
      return {
        entity_key: key,
        action: input.action,
        merge_into: input.merge_into ?? null,
        profile_id: input.profile_id ?? null,
      };
    },
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const patch: { source?: string; merged_into?: string | null; updated_at: string } = {
      updated_at: new Date().toISOString(),
    };
    if (data.action === "confirmed") patch.source = "confirmed";
    if (data.action === "rejected") patch.source = "rejected";
    if (data.action === "merged") {
      if (!data.merge_into || data.merge_into === data.entity_key) {
        throw new Error("Choose a different subject to fold this one into");
      }
      patch.merged_into = data.merge_into;
    }
    if (data.action === "unmerged") patch.merged_into = null;

    // Only the folded key changes. The target is never touched.
    const { error } = await supabase
      .from("work_item_entities")
      .update(patch)
      .eq("owner_id", profile.id)
      .eq("entity_key", data.entity_key);
    if (error) throw new Error(error.message);

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabase, {
      eventType: "entity.curated",
      orgId: profile.org_id,
      userId,
      profileId: profile.id,
      dims: { action: data.action, had_merge_target: data.action === "merged" },
    });
    return { ok: true };
  });

/**
 * A person read the model's handoff prose and said which piece of their own
 * work it points at. Only then does an edge exist, and it is written as
 * 'user_linked' because a person is how we know.
 */
export const confirmHandoffLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { from_item_id: string; to_item_id: string; profile_id?: string | undefined }) => {
      if (!input?.from_item_id || !input?.to_item_id) throw new Error("Two items are required");
      if (input.from_item_id === input.to_item_id) throw new Error("Choose a different piece");
      return {
        from_item_id: input.from_item_id,
        to_item_id: input.to_item_id,
        profile_id: input.profile_id ?? null,
      };
    },
  )
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; reason?: "no_turns" | "not_yours" }> => {
      const { supabase, userId } = context;
      const profile = await resolveProfile(supabase, userId, data.profile_id);
      if (!profile) throw new Response("Forbidden", { status: 403 });

      const { data: ends } = await supabase
        .from("work_items")
        .select("id, owner_id, type, source, source_vendor, source_meta, meta")
        .in("id", [data.from_item_id, data.to_item_id]);
      const from = (ends ?? []).find((r) => r.id === data.from_item_id);
      const to = (ends ?? []).find((r) => r.id === data.to_item_id);
      if (!from || !to || from.owner_id !== profile.id || to.owner_id !== profile.id) {
        return { ok: false, reason: "not_yours" };
      }

      const { recordUserLinkedChain } = await import("./chain-links.server");
      const result = await recordUserLinkedChain(data.from_item_id, data.to_item_id);
      if (result.reason === "no_turns") return { ok: false, reason: "no_turns" };

      // Observed, because a person vouched for it.
      const { noteHandoffObserved } = await import("./work-taxonomy.server");
      await noteHandoffObserved(
        supabase,
        { orgId: profile.org_id, userId, profileId: profile.id },
        { from: from as never, to: to as never },
      );
      return { ok: true };
    },
  );

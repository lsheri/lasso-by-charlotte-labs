import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { resolveProfile } from "./profile-resolve";
import type { CoachPerson, SharedWorkRow, SubjectLink } from "./coaching-links.server";

/**
 * PASS 170 — every coaching link change goes through the database routines that
 * already carry the rules. Nothing here writes to a coaching table directly,
 * except the person's own list of pieces they keep back, which only they can
 * read or change.
 */

type WithProfile = { profile_id?: string | undefined };

async function me(context: { supabase: unknown; userId: string }, profileId?: string | undefined) {
  const supabase = context.supabase as Parameters<typeof resolveProfile>[0];
  const profile = await resolveProfile(supabase, context.userId, profileId ?? null);
  return { supabase, profile };
}

export const listMyCoachingLinks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WithProfile | undefined) => ({ profile_id: input?.profile_id }))
  .handler(async ({ data, context }): Promise<SubjectLink[]> => {
    const { supabase, profile } = await me(context, data.profile_id);
    if (!profile) return [];
    const { listSubjectLinks } = await import("./coaching-links.server");
    return listSubjectLinks(supabase, profile.id);
  });

export const listCoachLinkPeople = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WithProfile | undefined) => ({ profile_id: input?.profile_id }))
  .handler(async ({ data, context }): Promise<CoachPerson[]> => {
    const { supabase, profile } = await me(context, data.profile_id);
    if (!profile) return [];
    const { listCoachPeople } = await import("./coaching-links.server");
    return listCoachPeople(supabase, profile.id);
  });

export const listLinkSharedWork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WithProfile & { link_id: string }) => ({
    profile_id: input.profile_id,
    link_id: String(input.link_id),
  }))
  .handler(async ({ data, context }): Promise<SharedWorkRow[]> => {
    const { supabase, profile } = await me(context, data.profile_id);
    if (!profile) return [];
    const { LINK_SELECT, listLinkWork } = await import("./coaching-links.server");
    const { data: rows } = await supabase
      .from("coaching_links")
      .select(LINK_SELECT)
      .eq("id", data.link_id)
      .limit(1);
    const link = rows?.[0];
    if (!link) return [];
    return listLinkWork(supabase, link, { asSubject: link.subject_profile_id === profile.id });
  });

type LinkAction = "consent" | "decline" | "withdraw" | "disclose" | "end";

const RPC: Record<LinkAction, "consent_to_coaching_link" | "withdraw_coaching_consent" | "record_coaching_disclosure" | "end_coaching_link"> = {
  consent: "consent_to_coaching_link",
  withdraw: "withdraw_coaching_consent",
  disclose: "record_coaching_disclosure",
  decline: "end_coaching_link",
  end: "end_coaching_link",
};

export const actOnCoachingLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WithProfile & { link_id: string; action: LinkAction }) => {
    if (!(input.action in RPC)) throw new Error("Unknown coaching action.");
    return {
      profile_id: input.profile_id,
      link_id: String(input.link_id),
      action: input.action,
    };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, profile } = await me(context, data.profile_id);
    if (!profile) throw new Error("Not signed in.");
    const { error } = await supabase.rpc(RPC[data.action], {
      p_link_id: data.link_id,
      p_actor_profile_id: profile.id,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/**
 * The pieces a person keeps out of coaching. Their own table, their own rows:
 * a coach never reads this, and no count of it is shown to anyone.
 */
export const setItemShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WithProfile & { link_id: string; work_item_id: string; shared: boolean }) => ({
    profile_id: input.profile_id,
    link_id: String(input.link_id),
    work_item_id: String(input.work_item_id),
    shared: Boolean(input.shared),
  }))
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, profile } = await me(context, data.profile_id);
    if (!profile) throw new Error("Not signed in.");
    if (data.shared) {
      const { error } = await supabase
        .from("coaching_item_exclusions")
        .delete()
        .eq("link_id", data.link_id)
        .eq("work_item_id", data.work_item_id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("coaching_item_exclusions")
        .upsert(
          { link_id: data.link_id, work_item_id: data.work_item_id },
          { onConflict: "link_id,work_item_id" },
        );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

/** Which of this person's own links currently hold a piece back. */
export const listItemExclusions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WithProfile & { work_item_id: string }) => ({
    profile_id: input.profile_id,
    work_item_id: String(input.work_item_id),
  }))
  .handler(async ({ data, context }): Promise<string[]> => {
    const { supabase, profile } = await me(context, data.profile_id);
    if (!profile) return [];
    const { data: rows } = await supabase
      .from("coaching_item_exclusions")
      .select("link_id")
      .eq("work_item_id", data.work_item_id);
    return (rows ?? []).map((row) => row.link_id);
  });

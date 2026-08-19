import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import { EMPTY_REFLECT_BOOT, type ReflectBoot } from "./reflect-boot-shared";

type Input = { profile_id?: string | null; session_id?: string | null };

/**
 * The Reflect page load in one call: the person's own sessions and, when one is
 * open, its messages. Both reads run on the caller's client, so the same row
 * level policies apply as when the browser read them one at a time.
 */
export const getReflectBoot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => ({
    profile_id: input.profile_id ?? null,
    session_id: input.session_id ?? null,
  }))
  .handler(async ({ data, context }): Promise<ReflectBoot> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return EMPTY_REFLECT_BOOT;

    const [sessionsRes, messagesRes] = await Promise.all([
      supabase
        .from("chat_sessions")
        .select("id, title, context_scope, updated_at")
        .eq("profile_id", profile.id)
        .order("updated_at", { ascending: false }),
      data.session_id
        ? supabase
            .from("chat_messages")
            .select("id, role, content, created_at, context_manifest")
            .eq("session_id", data.session_id)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (sessionsRes.error) throw new Error(sessionsRes.error.message);
    if (messagesRes.error) throw new Error(messagesRes.error.message);

    return {
      sessions: (sessionsRes.data ?? []) as ReflectBoot["sessions"],
      messages: (messagesRes.data ?? []) as unknown as ReflectBoot["messages"],
    };
  });

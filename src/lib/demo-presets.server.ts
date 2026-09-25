/**
 * Unit 2: regenerating the demo's saved answers. Run by an admin of the demo
 * org only, never by a visitor. Uses the real Ask Lasso pipeline, one chat,
 * questions in position order, so follow-ups see earlier manifests.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

type Db = SupabaseClient<Database>;

export type DemoAdminStatus = { canRegenerate: boolean; code: string | null };

async function demoAdminContext(
  supabase: Db,
  userId: string,
  engagementId: string,
): Promise<{ orgId: string; profileId: string; code: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { demoOrgId } = await import("./demo-board.server");
  const orgId = await demoOrgId(supabaseAdmin);
  if (!orgId) return null;
  const { data: eng } = await supabaseAdmin
    .from("engagements")
    .select("id, org_id, code")
    .eq("id", engagementId)
    .maybeSingle();
  if (!eng || eng.org_id !== orgId) return null;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, org_id")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .is("deactivated_at", null)
    .limit(1);
  const profile = profiles?.[0];
  if (!profile) return null;
  // The role check runs as the caller, never through the admin client.
  const { data: isAdmin } = await supabase.rpc("has_org_role", { p_org: orgId, p_roles: ["admin"] });
  if (isAdmin !== true) return null;
  return { orgId, profileId: profile.id, code: eng.code };
}

export async function demoAdminStatus(supabase: Db, userId: string, engagementId: string): Promise<DemoAdminStatus> {
  const ctx = await demoAdminContext(supabase, userId, engagementId).catch(() => null);
  return ctx ? { canRegenerate: true, code: ctx.code } : { canRegenerate: false, code: null };
}

export async function regenerateDemoPresets(
  supabase: Db,
  userId: string,
  engagementId: string,
): Promise<{ answered: number; total: number }> {
  const ctx = await demoAdminContext(supabase, userId, engagementId);
  if (!ctx) throw new Response("Forbidden", { status: 403 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error } = await supabaseAdmin
    .from("demo_presets")
    .select("id, position, question")
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  const presets = rows ?? [];
  if (presets.length === 0) return { answered: 0, total: 0 };

  const { data: session, error: sessionError } = await supabase
    .from("chat_sessions")
    .insert({
      profile_id: ctx.profileId,
      org_id: ctx.orgId,
      context_scope: { mode: "engagements", ids: [engagementId] },
      title: `Demo answers: ${ctx.code}`.slice(0, 120),
    })
    .select("id")
    .single();
  if (sessionError || !session) throw new Error(sessionError?.message ?? "Could not start the chat.");

  const { runReflectTurn } = await import("./reflect-run.server");
  const commit = process.env["COMMIT_SHA"] ?? process.env["GIT_COMMIT"] ?? null;
  let answered = 0;
  for (const preset of presets) {
    const result = await runReflectTurn(supabase, userId, {
      session_id: session.id,
      message: preset.question,
      profile_id: ctx.profileId,
      surface: "ask_lasso",
    });
    const { error: writeError } = await supabaseAdmin
      .from("demo_presets")
      .update({
        answer: result.answer,
        context_manifest: (result.manifest ?? null) as never,
        turn_refs: result.turnRefs as never,
        generated_at: new Date().toISOString(),
        generated_from_commit: commit,
      })
      .eq("id", preset.id);
    if (writeError) throw new Error(writeError.message);
    answered += 1;
  }

  const { recordEvent } = await import("./telemetry.server");
  await recordEvent(supabase, {
    eventType: "demo.presets_regenerated",
    orgId: ctx.orgId,
    userId,
    profileId: ctx.profileId,
    dims: { code: ctx.code.toLowerCase(), answered },
  });
  return { answered, total: presets.length };
}

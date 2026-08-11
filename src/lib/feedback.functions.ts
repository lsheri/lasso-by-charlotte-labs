import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const FEEDBACK_CATEGORIES = ["Bug", "Confusing", "Idea", "Other"] as const;
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number];

const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** "/engagements/9f2…" → "/engagements/:id" — a route pattern, never a raw URL. */
export function routePattern(path: string): string {
  return path.split("?")[0]!.replace(UUID, ":id");
}

type Input = {
  category: string;
  expected?: string | undefined;
  actual: string;
  url_path: string;
  profile_id?: string | undefined;
};

export const submitFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }) => {
    const actual = data.actual.trim();
    if (!actual) throw new Error("Tell us what happened first.");
    const category = (FEEDBACK_CATEGORIES as readonly string[]).includes(data.category)
      ? data.category
      : "Other";

    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const path = routePattern(data.url_path);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feedback").insert({
      org_id: profile.org_id,
      profile_id: profile.id,
      category,
      url_path: path,
      expected: data.expected?.trim() || null,
      actual,
      status: "new",
    });
    if (error) throw new Error(error.message);

    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(supabaseAdmin, {
      eventType: "feedback.submitted",
      orgId: profile.org_id,
      userId: context.userId,
      dims: { category, path },
    });
    return { ok: true };
  });

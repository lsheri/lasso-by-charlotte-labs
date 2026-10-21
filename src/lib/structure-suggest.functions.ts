import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import { validateInput, type StructureSourceKind } from "@/lib/structure-suggest-shared";

export const suggestStructuresFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; kind: StructureSourceKind; engagementId: string }) => {
    if (!input?.engagementId) throw new Error("Board is required.");
    return { text: input.text, kind: input.kind, engagementId: input.engagementId };
  })
  .handler(async ({ data, context }) => {
    const { data: board, error } = await context.supabase.from("engagements")
      .select("org_id").eq("id", data.engagementId).maybeSingle();
    if (error || !board?.org_id) throw new Error("This board is not available to you.");
    const profile = await resolveProfile(context.supabase, context.userId, undefined, board.org_id);
    if (!profile || profile.role === "coach" || profile.role === "guest") throw new Error("This board is not available to you.");
    const input = validateInput(data);
    if (!input.ok) return { status: "refused" as const, reason: input.reason };
    const { suggestStructures } = await import("@/lib/structure-suggest.server");
    return suggestStructures(input.value, { surface: "workboard", userId: context.userId, profileId: profile.id, orgId: board.org_id }, board.org_id);
  });
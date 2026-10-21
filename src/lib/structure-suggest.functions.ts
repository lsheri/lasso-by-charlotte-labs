import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import { validateInput, type StructureSourceKind } from "@/lib/structure-suggest-shared";

export async function requireSuggestionProfile(context: { supabase: Parameters<typeof resolveProfile>[0]; userId: string }, engagementId: string) {
  const { data: board, error } = await context.supabase.from("engagements")
    .select("org_id, title").eq("id", engagementId).maybeSingle();
  if (error || !board?.org_id) throw new Error("This board is not available to you.");
  const profile = await resolveProfile(context.supabase, context.userId, undefined, board.org_id);
  if (!profile || profile.role === "coach") throw new Error("This board is not available to you.");
  return { profile, boardTitle: typeof board.title === "string" ? board.title : undefined };
}

export const suggestStructuresFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string; kind: StructureSourceKind; engagementId: string }) => {
    if (!input?.engagementId) throw new Error("Board is required.");
    return { text: input.text, kind: input.kind, engagementId: input.engagementId };
  })
  .handler(async ({ data, context }) => {
    const { profile, boardTitle } = await requireSuggestionProfile(context, data.engagementId);
    const input = validateInput(data);
    if (!input.ok) return { status: "refused" as const, reason: input.reason };
    const { suggestStructures } = await import("@/lib/structure-suggest.server");
    return suggestStructures(input.value, { surface: "structure_suggest", userId: context.userId, profileId: profile.id, orgId: profile.org_id }, profile.org_id, undefined, boardTitle);
  });
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ArchiveSearchResult } from "@/lib/archive-search-shared";

type SearchInput = { question: string };

function validate(input: SearchInput): SearchInput {
  const question = typeof input?.question === "string" ? input.question.trim() : "";
  if (!question) throw new Error("Ask the archive something first.");
  return { question: question.slice(0, 500) };
}

/** Members and admins only. A coach has no archive, so they get 403. */
export const searchArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<ArchiveSearchResult> => {
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("id, role, org_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });

    const { runArchiveSearch } = await import("./archive-search.server");
    return runArchiveSearch(context.supabase as never, {
      question: data.question,
      orgId: profile.org_id,
      userId: context.userId,
      profileId: profile.id,
    });
  });

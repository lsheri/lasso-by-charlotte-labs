import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PastWorkCandidate, PastWorkSearchResult } from "@/lib/past-work-shared";

type SearchInput = { description: string };

function validate(input: SearchInput): SearchInput {
  const description = typeof input?.description === "string" ? input.description.trim() : "";
  if (!description) throw new Error("Describe the work first.");
  return { description: description.slice(0, 600) };
}

/**
 * Pass 138: find shipped work like the work you are about to do. Every org
 * member may ask. The candidate set is the caller's own RLS read of
 * shipped_work, so nothing unshipped can enter an answer.
 */
export const searchPastWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(
    async ({
      data,
      context,
    }): Promise<PastWorkSearchResult & { candidates: PastWorkCandidate[] }> => {
      const { data: profile } = await context.supabase
        .from("profiles")
        .select("id, org_id")
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!profile) throw new Response("Forbidden", { status: 403 });

      const { runPastWorkSearch } = await import("./past-work.server");
      return runPastWorkSearch(context.supabase as never, {
        description: data.description,
        orgId: profile.org_id,
        userId: context.userId,
      });
    },
  );

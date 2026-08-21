import { useQuery } from "@tanstack/react-query";

import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/work-types";

const SURFACE_LABEL: Record<string, string> = {
  reflect: "Your assistant",
  ask_lasso: "Your assistant",
  coach_chat: "Coach's assistant",
  trace: "Your assistant",
  packet: "Coach's assistant",
};

/**
 * Questions other people asked an assistant about this person's work. The
 * owner sees everything about themselves; a coach never sees this at all,
 * because the section only renders for the owner.
 */
function QuestionsAsked({ profileId }: { profileId: string }) {
  const { data } = useQuery({
    queryKey: ["query-log", profileId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("query_log")
        .select(
          "id, question, scope, created_at, asker_id, profiles!query_log_asker_id_fkey(display_name)",
        )
        .eq("subject_id", profileId)
        .neq("asker_id", profileId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return (rows ?? []) as unknown as {
        id: string;
        question: string;
        scope: string;
        created_at: string;
        profiles: { display_name: string } | null;
      }[];
    },
  });

  if (!data || data.length === 0) return null;
  return (
    <div className="mt-8 border-t border-border pt-4">
      <h3 className="micro-label micro-label-ai">Questions asked about your work</h3>
      <ul className="mt-2 space-y-1.5">
        {data.map((row) => (
          <li key={row.id} className="text-xs text-muted-foreground">
            <span className="text-foreground">{row.profiles?.display_name ?? "Someone"}</span>{" "}
            asked: &ldquo;{row.question}&rdquo;, {formatDate(row.created_at)}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Owner-only. Shows, quietly, when an assistant actually read this item and
 * how deeply. Last ten only; no counts anywhere else in the product.
 */
export function AiReads({ workItemId }: { workItemId: string }) {
  const { data: profile } = useProfile();
  const { data } = useQuery({
    queryKey: ["ai-reads", workItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_reads")
        .select("id, reader_role, surface, depth, created_at")
        .eq("work_item_id", workItemId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const hasReads = Boolean(data && data.length > 0);

  return (
    <>
      {hasReads ? (
        <section className="mt-8 border-t border-border pt-4">
          <h3 className="micro-label micro-label-ai">AI reads</h3>
          <ul className="mt-2 space-y-1">
            {(data ?? []).map((read) => (
              <li key={read.id} className="text-xs text-muted-foreground">
                {read.reader_role === "owner"
                  ? `You read the ${read.depth === "full" ? "full text" : "summary"}`
                  : `${SURFACE_LABEL[read.surface] ?? "An assistant"} read the ${read.depth === "full" ? "full text" : "summary"}`}
                , {formatDate(read.created_at)}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {profile ? <QuestionsAsked profileId={profile.id} /> : null}
    </>
  );
}

import { useQuery } from "@tanstack/react-query";

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
 * Owner-only. Shows, quietly, when an assistant actually read this item and
 * how deeply. Last ten only; no counts anywhere else in the product.
 */
export function AiReads({ workItemId }: { workItemId: string }) {
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

  if (!data || data.length === 0) return null;

  return (
    <section className="mt-8 border-t border-border pt-4">
      <h3 className="micro-label">AI reads</h3>
      <ul className="mt-2 space-y-1">
        {data.map((read) => (
          <li key={read.id} className="text-xs text-muted-foreground">
            {read.reader_role === "owner"
              ? `You read the ${read.depth === "full" ? "full text" : "summary"}`
              : `${SURFACE_LABEL[read.surface] ?? "An assistant"} read the ${read.depth === "full" ? "full text" : "summary"}`}
            , {formatDate(read.created_at)}
          </li>
        ))}
      </ul>
    </section>
  );
}

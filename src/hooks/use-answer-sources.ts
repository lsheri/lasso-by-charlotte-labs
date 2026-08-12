import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { ContextSource } from "@/lib/reflect-shared";

type ReadRow = {
  message_id: number | null;
  depth: string;
  work_item_id: string;
  work_items: {
    title: string | null;
    type: string | null;
    source_vendor: string | null;
  } | null;
};

/**
 * Reads back what the model actually saw, per assistant message, so the audit
 * strip under an answer is the recorded truth rather than a client guess.
 */
export function useAnswerSources(messageIds: number[]) {
  const key = messageIds.slice().sort((a, b) => a - b);
  return useQuery({
    queryKey: ["answer-sources", key],
    enabled: key.length > 0,
    queryFn: async (): Promise<Record<number, ContextSource[]>> => {
      const { data, error } = await supabase
        .from("ai_reads")
        .select("message_id, depth, work_item_id, work_items(title, type, source_vendor)")
        .in("message_id", key);
      if (error) throw error;
      const grouped: Record<number, ContextSource[]> = {};
      for (const row of (data ?? []) as unknown as ReadRow[]) {
        if (row.message_id === null) continue;
        const list = grouped[row.message_id] ?? (grouped[row.message_id] = []);
        list.push({
          id: row.work_item_id,
          title: row.work_items?.title ?? "Untitled",
          type: row.work_items?.type ?? "document",
          source_vendor: row.work_items?.source_vendor ?? null,
          depth:
            row.depth === "full"
              ? "full"
              : row.depth === "unreadable"
                ? "unreadable"
                : row.depth === "catalogue"
                  ? "catalogue"
                  : "extract",
        });
      }
      return grouped;
    },
  });
}

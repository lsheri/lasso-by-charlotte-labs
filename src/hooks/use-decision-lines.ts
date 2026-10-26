import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];
export type DecisionLine = Pick<DecisionRow, "id" | "document_id" | "ord" | "call_text" | "why" | "status" | "srcs">;
export const LEDGER_LINES_KEY = (documentId: string | null) => ["decision-lines", documentId] as const;

export function useDecisionLines(documentId: string | null) {
  return useQuery({
    queryKey: LEDGER_LINES_KEY(documentId),
    enabled: Boolean(documentId),
    queryFn: async (): Promise<DecisionLine[]> => {
      if (!documentId) return [];
      const { data, error } = await supabase.from("decisions")
        .select("id, document_id, ord, call_text, why, status, srcs")
        .eq("document_id", documentId).order("ord", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function ledgerTurnOf(line: Pick<DecisionLine, "srcs">): number | null {
  const source = Array.isArray(line.srcs) ? line.srcs[0] : null;
  const turn = source && typeof source === "object" && !Array.isArray(source) ? source["turn"] : null;
  return typeof turn === "number" && Number.isInteger(turn) && turn > 0 ? turn : null;
}

export function statusWord(status: DecisionLine["status"]): "Open" | "Agreed" | "Dropped" {
  return { draft: "Open", confirmed: "Agreed", discarded: "Dropped" }[status] as "Open" | "Agreed" | "Dropped";
}
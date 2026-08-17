import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { DeliverableKind } from "@/lib/deliverable-kinds";

/**
 * Writes work_items.meta.deliverable_kind through the ordinary item update
 * path, so the owner's own row level policies decide whether it lands.
 */
export async function setDeliverableKind(
  workItemId: string,
  kind: DeliverableKind | null,
): Promise<void> {
  const { data, error: readError } = await supabase
    .from("work_items")
    .select("meta")
    .eq("id", workItemId)
    .maybeSingle();
  if (readError) throw readError;

  const meta = { ...((data?.meta ?? {}) as Record<string, unknown>) };
  if (kind) meta["deliverable_kind"] = kind;
  else delete meta["deliverable_kind"];

  const { error } = await supabase
    .from("work_items")
    .update({ meta: meta as Json })
    .eq("id", workItemId);
  if (error) throw error;
}

export function useInvalidateWorkItems() {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
  };
}

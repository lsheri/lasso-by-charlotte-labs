import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { detachEpisodeItems } from "@/lib/episodes.functions";
import { logEvent } from "@/lib/telemetry";
import { logV2 } from "@/lib/telemetry-v2";
import type { WorkItemRow } from "@/lib/work-types";

/**
 * PASS 129 — one make private path, shared by the Work pile and the engagement
 * peek. The semantics are exactly what the Work page did: unmap, detach the
 * episode items, then set visibility to private.
 */
export function useMakePrivate() {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const detachEpisode = useServerFn(detachEpisodeItems);

  return async function makePrivate(item: WorkItemRow): Promise<string | null> {
    const del = await supabase.from("work_item_tasks").delete().eq("work_item_id", item.id);
    if (del.error) return del.error.message;
    await detachEpisode({ data: { work_item_ids: [item.id] } });
    const upd = await supabase
      .from("work_items")
      .update({ visibility: "private" })
      .eq("id", item.id);
    if (upd.error) return upd.error.message;
    if (profile) {
      logEvent("workitem.marked_private", profile.org_id, { type: item.type, source: item.source });
      logV2(
        "work_item.marked_private",
        { item_type: item.type },
        { profileId: profile.id, workItemId: item.id },
      );
    }
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    return null;
  };
}

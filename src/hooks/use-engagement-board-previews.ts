import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  HOME_PREVIEW_FRAME_CAP,
  HOME_PREVIEW_NODE_CAP,
  type HomePreviewBoard,
  type HomePreviewState,
} from "@/lib/home-board-preview";

export const HOME_PREVIEW_SELECT = [
  "engagement_id",
  "workboard_frames(x,y,w,h,fill)",
  "workboard_nodes(x,y,w,h)",
].join(",");

type PreviewQueryRow = {
  engagement_id: string;
  workboard_frames: HomePreviewBoard["frames"] | null;
  workboard_nodes: HomePreviewBoard["nodes"] | null;
};

/** One bounded read for every visible engagement. Earliest-created shapes win the cap for deterministic, stable previews. */
export async function fetchEngagementBoardPreviews(
  engagementIds: readonly string[],
): Promise<Map<string, HomePreviewBoard>> {
  if (engagementIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from("workboards")
    .select(HOME_PREVIEW_SELECT)
    .in("engagement_id", [...engagementIds])
    .is("workboard_frames.deleted_at", null)
    .is("workboard_nodes.deleted_at", null)
    .eq("workboard_nodes.hidden", false)
    .order("created_at", { referencedTable: "workboard_frames", ascending: true })
    .order("created_at", { referencedTable: "workboard_nodes", ascending: true })
    .limit(HOME_PREVIEW_FRAME_CAP, { referencedTable: "workboard_frames" })
    .limit(HOME_PREVIEW_NODE_CAP, { referencedTable: "workboard_nodes" });
  if (error) throw error;
  return new Map(((data ?? []) as unknown as PreviewQueryRow[]).map((row) => [
    row.engagement_id,
    { frames: row.workboard_frames ?? [], nodes: row.workboard_nodes ?? [] },
  ]));
}

export function useEngagementBoardPreviews(engagementIds: readonly string[] | undefined) {
  const ids = [...(engagementIds ?? [])].sort();
  const query = useQuery({
    queryKey: ["engagement-board-previews", ids],
    queryFn: () => fetchEngagementBoardPreviews(ids),
    enabled: Boolean(engagementIds),
  });
  const previews = new Map<string, HomePreviewState>();
  for (const id of ids) {
    previews.set(id, query.data
      ? { status: "ready", board: query.data.get(id) ?? { frames: [], nodes: [] } }
      : { status: "loading" });
  }
  return { ...query, previews };
}

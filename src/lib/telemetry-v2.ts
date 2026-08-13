import { emitV2 } from "./telemetry-v2.functions";
import type { EventNameV2 } from "./telemetry-v2-shared";

export type PropsV2 = Record<string, string | number | boolean>;

/**
 * Fire and forget, from the browser. Never blocks the action that caused it and
 * never surfaces a failure. Identity, org and consent are resolved server side.
 */
export function logV2(
  eventName: EventNameV2,
  props: PropsV2,
  ids?: {
    profileId?: string | undefined;
    workItemId?: string | undefined;
    engagementId?: string | undefined;
    episodeId?: string | undefined;
  },
): void {
  void emitV2({
    data: {
      event_name: eventName,
      props,
      profile_id: ids?.profileId,
      work_item_id: ids?.workItemId,
      engagement_id: ids?.engagementId,
      episode_id: ids?.episodeId,
    },
  }).catch(() => {
    /* the record of practice is never worth an error in front of someone */
  });
}

/** Maps a work item's source string onto the capture channel vocabulary. */
export function captureChannelOf(source: string): "paste" | "upload" | "import" | "mcp" | "connector" {
  if (source.startsWith("mcp")) return "mcp";
  if (source === "upload") return "upload";
  if (source === "paste") return "paste";
  if (source.startsWith("import")) return "import";
  return "connector";
}

/**
 * The deliverable's own lifecycle, declared by the person who did the work.
 * Closing goes through closeEpisode unchanged. Reopening has no write path
 * today, so the menu states that plainly rather than pretending.
 */

export type CloseChoice = "delivered" | "accepted" | "abandoned";

export const WORKSTREAM_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  delivered: "Delivered",
  accepted: "Accepted",
  abandoned: "Set aside",
  closed: "Closed",
};

export const STATUS_EXPLAINER =
  "Record what happened to this deliverable. This is yours; nobody is grading it.";

export const STATUS_EXPLAINER_SEEN_KEY = "lasso.status_explainer_seen";

/** No server function accepts a reopen today, so the option cannot be offered. */
export const REOPEN_SUPPORTED = false;
export const REOPEN_UNAVAILABLE_LINE = "Reopening is not available yet.";

export type StatusOption = { value: "open" | CloseChoice; label: string; enabled: boolean };

export const STATUS_MENU: StatusOption[] = [
  { value: "open", label: WORKSTREAM_STATUS_LABELS["open"] as string, enabled: REOPEN_SUPPORTED },
  { value: "delivered", label: WORKSTREAM_STATUS_LABELS["delivered"] as string, enabled: true },
  { value: "accepted", label: WORKSTREAM_STATUS_LABELS["accepted"] as string, enabled: true },
  { value: "abandoned", label: WORKSTREAM_STATUS_LABELS["abandoned"] as string, enabled: true },
];

/** Exactly the input closeEpisode validates, built in one place. */
export function closeEpisodePayload(
  episodeId: string,
  choice: CloseChoice,
  profileId: string | undefined,
): { episode_id: string; status: CloseChoice; profile_id: string | undefined } {
  return { episode_id: episodeId, status: choice, profile_id: profileId };
}

export function isCloseChoice(value: string): value is CloseChoice {
  return value === "delivered" || value === "accepted" || value === "abandoned";
}
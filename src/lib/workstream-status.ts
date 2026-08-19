/**
 * The deliverable's own lifecycle, declared by the person who did the work.
 * Closing goes through closeEpisode unchanged. Reopening has no write path
 * today, so the menu states that plainly rather than pretending.
 */

export type CloseChoice = "delivered" | "accepted" | "abandoned";
export type StatusChoice = "open" | CloseChoice;

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

/** closeEpisode accepts "open" through the same guards, so reopening is real. */
export const REOPEN_SUPPORTED = true;
export const REOPEN_LINE = "Reopening puts this back to open and clears the dates.";

export type StatusOption = { value: StatusChoice; label: string; enabled: boolean };

export const STATUS_MENU: StatusOption[] = [
  { value: "open", label: WORKSTREAM_STATUS_LABELS["open"] as string, enabled: REOPEN_SUPPORTED },
  { value: "delivered", label: WORKSTREAM_STATUS_LABELS["delivered"] as string, enabled: true },
  { value: "accepted", label: WORKSTREAM_STATUS_LABELS["accepted"] as string, enabled: true },
  { value: "abandoned", label: WORKSTREAM_STATUS_LABELS["abandoned"] as string, enabled: true },
];

/** Exactly the input closeEpisode validates, built in one place. */
export function closeEpisodePayload(
  episodeId: string,
  choice: StatusChoice,
  profileId: string | undefined,
): { episode_id: string; status: StatusChoice; profile_id: string | undefined } {
  return { episode_id: episodeId, status: choice, profile_id: profileId };
}

export function isCloseChoice(value: string): value is CloseChoice {
  return value === "delivered" || value === "accepted" || value === "abandoned";
}

export function isStatusChoice(value: string): value is StatusChoice {
  return value === "open" || isCloseChoice(value);
}
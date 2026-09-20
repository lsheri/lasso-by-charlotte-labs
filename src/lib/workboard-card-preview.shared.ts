export type WorkboardDisplayMode = "sticky" | "preview";

export type WorkboardPreviewTurn = {
  turnNo: number;
  role: string;
  content: string;
};

export type WorkboardCardPreview = {
  workItemId: string;
  turns: WorkboardPreviewTurn[];
  turnCount: number;
  model: string | null;
};

export function workboardDisplayModeKey(profileId: string, engagementId: string): string {
  return `lasso:workboard:${profileId}:${engagementId}:display`;
}

export function readWorkboardDisplayMode(value: string | null): WorkboardDisplayMode {
  return value === "preview" ? "preview" : "sticky";
}

/** A focused mini-window consumes the wheel only while it can move that way. */
export function previewWheelConsumesScroll(
  focused: boolean,
  deltaY: number,
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): boolean {
  if (!focused || deltaY === 0) return false;
  return deltaY < 0 ? scrollTop > 0 : scrollTop + clientHeight < scrollHeight;
}
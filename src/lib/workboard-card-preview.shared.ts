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
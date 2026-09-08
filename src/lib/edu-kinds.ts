/**
 * A school workspace splits its engagements into classes and projects. The kind
 * lives in the workspace settings jsonb that already exists, keyed by
 * engagement id, so no column and no new table is involved.
 */

export type EngagementKind = "class" | "project";

export const KIND_QUESTION = "Is this a class or a project?";
export const KIND_LABELS: Record<EngagementKind, string> = {
  class: "A class",
  project: "A project",
};

const SETTINGS_KEY = "edu_engagement_kinds";

export type OrgSettings = Record<string, unknown> | null | undefined;

export function readKinds(settings: OrgSettings): Record<string, EngagementKind> {
  const raw = (settings ?? {})[SETTINGS_KEY];
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, EngagementKind> = {};
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === "class" || value === "project") out[id] = value;
  }
  return out;
}

export function kindOf(settings: OrgSettings, engagementId: string): EngagementKind | null {
  return readKinds(settings)[engagementId] ?? null;
}

/** A new settings object with one engagement's kind set. Never mutates. */
export function withKind(
  settings: OrgSettings,
  engagementId: string,
  kind: EngagementKind,
): Record<string, unknown> {
  return {
    ...(settings ?? {}),
    [SETTINGS_KEY]: { ...readKinds(settings), [engagementId]: kind },
  };
}

/**
 * S-T1: the closed vocabulary for settings.changed. Every dim value is picked
 * from a fixed list here; a value outside the list drops the whole event.
 * Never carries the old or new value of any free-text field.
 */

export const SETTINGS_SECTIONS = [
  "profile",
  "workspace",
  "members",
  "connectors",
  "ai_tools",
  "imports",
  "privacy",
  "data_deletion",
  "notifications",
  "appearance",
  "other",
] as const;

export const SETTINGS_KEYS = [
  "display_name",
  "role_family",
  "seniority_band",
  "work_types",
  "clients_enabled",
  "workspace_name",
  "allowed_domains",
  "naming_conventions",
  "member_role",
  "member_removed",
  "data_level_workspace",
  "data_level_personal",
  "research_participation",
  "connector",
] as const;

export const SETTINGS_CHANGES = ["on", "off", "updated", "added", "removed"] as const;

export const SETTINGS_LEVELS = ["t0", "a", "b", "c", "d"] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];
export type SettingsKey = (typeof SETTINGS_KEYS)[number];
export type SettingsChange = (typeof SETTINGS_CHANGES)[number];
export type SettingsLevel = (typeof SETTINGS_LEVELS)[number];

export type SettingsChangedDims = {
  section: SettingsSection;
  setting: SettingsKey;
  change: SettingsChange;
  to_level?: SettingsLevel;
};

function inList<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === "string" && (list as readonly string[]).includes(value);
}

/**
 * Builds the dims, or null when any value is outside the closed lists.
 * to_level is kept only on data_level_* settings.
 */
export function settingsChangedDims(input: {
  section: string;
  setting: string;
  change: string;
  to_level?: string | undefined;
}): SettingsChangedDims | null {
  if (!inList(SETTINGS_SECTIONS, input.section)) return null;
  if (!inList(SETTINGS_KEYS, input.setting)) return null;
  if (!inList(SETTINGS_CHANGES, input.change)) return null;
  const dims: SettingsChangedDims = {
    section: input.section,
    setting: input.setting,
    change: input.change,
  };
  if (input.setting.startsWith("data_level_")) {
    if (!inList(SETTINGS_LEVELS, input.to_level)) return null;
    dims.to_level = input.to_level;
  }
  return dims;
}

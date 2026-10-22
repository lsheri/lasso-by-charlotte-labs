/** WI-1: the one rule for naming a work item to a human: display_title ?? title. */
export function displayName(item: { display_title?: string | null | undefined; title?: string | null | undefined }): string {
  const chosen = typeof item.display_title === "string" ? item.display_title.trim() : "";
  if (chosen) return chosen;
  return item.title ?? "";
}

/** A search term matches when it hits the chosen name or the original, so neither spelling fails. */
export function nameMatches(item: { display_title?: string | null | undefined; title?: string | null | undefined }, term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return true;
  return displayName(item).toLowerCase().includes(needle) || (item.title ?? "").toLowerCase().includes(needle);
}

/** Store "no chosen name" as null, never as a copy of the original title. */
export function normalizeDisplayTitle(input: string, originalTitle: string): string | null {
  const value = input.trim();
  if (!value || value === (originalTitle ?? "").trim()) return null;
  return value;
}

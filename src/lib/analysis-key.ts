/**
 * The reuse key for an analysis run. A run over a different anchor, a
 * different named check, or a different set of extra work is a different run,
 * so each of those has to be part of the key.
 */
export function analysisIdempotencyKey(input: {
  presetId: string;
  scopeType: "item" | "deliverable" | "engagement";
  scopeId: string;
  profileId: string;
  checkId?: string | null;
  extraIds?: readonly string[];
}): string {
  const checkPart = input.checkId ? `:check:${input.checkId}` : "";
  const extras = input.scopeType === "engagement" ? [] : [...(input.extraIds ?? [])].sort();
  const extraPart = extras.length === 0 ? "" : `:with:${extras.join(",")}`;
  return `${input.presetId}:${input.scopeType}:${input.scopeId}:${input.profileId}${checkPart}${extraPart}`;
}

/**
 * Suggested board structures: the contract and its validator.
 *
 * Pure. No network, no React. Shared by the server generator, tests and a
 * later client surface. Nothing here writes to a board.
 */

export type StructureSourceKind = "transcript" | "document" | "mixed";

export type StructureSuggestInput = { text: string; kind: StructureSourceKind };

export const STRUCTURE_CUTS = ["question", "deliverable", "workstream", "phase"] as const;
export type StructureCut = (typeof STRUCTURE_CUTS)[number];

export type SuggestedStructure = {
  id: string;
  cut: StructureCut;
  title: string;
  why: string;
  regions: string[];
};

/** 200 KB of input, measured in UTF-8 bytes. Above it the request is refused, never cut. */
export const STRUCTURE_INPUT_MAX_BYTES = 200 * 1024;
export const STRUCTURE_COUNT = 3;
export const REGIONS_MIN = 3;
export const REGIONS_MAX = 5;
export const REGION_NAME_MAX = 32;

/** Names that describe any engagement and therefore none. A match rejects the whole structure. */
export const GENERIC_REGION_NAMES: readonly string[] = [
  "discovery",
  "analysis",
  "recommendation",
  "recommendations",
  "next steps",
  "research",
  "findings",
  "conclusion",
  "conclusions",
  "change management",
  "operating model",
  "data and analytics",
  "project management",
  "miscellaneous",
  "misc",
  "other",
  "general",
];

export type StructureRejection =
  | "not_an_object"
  | "bad_cut"
  | "missing_title"
  | "missing_why"
  | "regions_not_list"
  | "too_few_regions"
  | "too_many_regions"
  | "empty_region_name"
  | "region_name_too_long"
  | "generic_region_name"
  | "duplicate_region_name";

export type InputRefusal = "empty_text" | "text_too_large" | "bad_kind";

export function isGenericRegionName(name: string): boolean {
  const key = name.trim().toLowerCase().replace(/\s+/g, " ");
  return GENERIC_REGION_NAMES.includes(key);
}

export function validateInput(input: unknown): { ok: true; value: StructureSuggestInput } | { ok: false; reason: InputRefusal } {
  const raw = (input ?? {}) as { text?: unknown; kind?: unknown };
  if (raw.kind !== "transcript" && raw.kind !== "document" && raw.kind !== "mixed") return { ok: false, reason: "bad_kind" };
  if (typeof raw.text !== "string" || raw.text.trim().length === 0) return { ok: false, reason: "empty_text" };
  if (new TextEncoder().encode(raw.text).length > STRUCTURE_INPUT_MAX_BYTES) return { ok: false, reason: "text_too_large" };
  return { ok: true, value: { text: raw.text, kind: raw.kind } };
}

/** One structure, checked. Returns the cleaned structure or the first reason it fails. */
export function validateStructure(raw: unknown): { ok: true; value: SuggestedStructure } | { ok: false; reason: StructureRejection } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, reason: "not_an_object" };
  const entry = raw as Record<string, unknown>;
  if (typeof entry.cut !== "string" || !(STRUCTURE_CUTS as readonly string[]).includes(entry.cut)) return { ok: false, reason: "bad_cut" };
  if (typeof entry.title !== "string" || !entry.title.trim()) return { ok: false, reason: "missing_title" };
  if (typeof entry.why !== "string" || !entry.why.trim()) return { ok: false, reason: "missing_why" };
  if (!Array.isArray(entry.regions)) return { ok: false, reason: "regions_not_list" };
  if (entry.regions.length < REGIONS_MIN) return { ok: false, reason: "too_few_regions" };
  if (entry.regions.length > REGIONS_MAX) return { ok: false, reason: "too_many_regions" };
  const seen = new Set<string>();
  const regions: string[] = [];
  for (const region of entry.regions) {
    if (typeof region !== "string" || !region.trim()) return { ok: false, reason: "empty_region_name" };
    const name = region.trim();
    if (name.length > REGION_NAME_MAX) return { ok: false, reason: "region_name_too_long" };
    if (isGenericRegionName(name)) return { ok: false, reason: "generic_region_name" };
    const key = name.toLowerCase();
    if (seen.has(key)) return { ok: false, reason: "duplicate_region_name" };
    seen.add(key);
    regions.push(name);
  }
  const id = typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : `${entry.cut}`;
  return { ok: true, value: { id, cut: entry.cut as StructureCut, title: entry.title.trim(), why: entry.why.trim(), regions } };
}

export type ResponseCheck = {
  valid: SuggestedStructure[];
  rejected: { index: number; reason: StructureRejection | "duplicate_cut" | "second_phase" }[];
};

/**
 * A whole model response. Each structure is checked on its own; structures
 * that pass keep their order. Cuts never repeat and "phase" appears at most once.
 */
export function validateStructures(raw: unknown): ResponseCheck {
  const list = raw && typeof raw === "object" && Array.isArray((raw as { structures?: unknown }).structures)
    ? ((raw as { structures: unknown[] }).structures)
    : Array.isArray(raw) ? raw : [];
  const check: ResponseCheck = { valid: [], rejected: [] };
  list.forEach((entry, index) => {
    const result = validateStructure(entry);
    if (!result.ok) { check.rejected.push({ index, reason: result.reason }); return; }
    if (check.valid.some((kept) => kept.cut === result.value.cut)) {
      check.rejected.push({ index, reason: result.value.cut === "phase" ? "second_phase" : "duplicate_cut" });
      return;
    }
    check.valid.push(result.value);
  });
  return check;
}

export type StructureSuggestResult =
  | { status: "ok"; structures: SuggestedStructure[]; shortfall: string | null }
  | { status: "refused"; reason: InputRefusal }
  | { status: "failed"; reason: string };

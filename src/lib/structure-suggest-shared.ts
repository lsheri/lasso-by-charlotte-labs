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

/** 2 MB of input, measured in UTF-8 bytes. Above it the request is refused, never cut. */
export const STRUCTURE_INPUT_MAX_BYTES = 2 * 1024 * 1024;
export const DIGEST_CHUNK_MAX_BYTES = 40 * 1024;
export const DIGEST_CHUNKS_MAX = 50;
export type StructureDigest = {
  names: { name: string; kind: "place" | "object" | "function" | "cost_pool" | "decision" | "deliverable" | "date"; mentions: number }[];
  statedGoal: string | null;
  arc: string | null;
};
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
  | "possessive_region_name"
  | "duplicate_region_name";

export type InputRefusal = "empty_text" | "text_too_large" | "bad_kind" | "too_many_chunks" | "word_too_large";

/** Preserve every character. Prefer paragraphs in the final tenth of a full chunk. */
export function chunkInput(text: string): { ok: true; chunks: string[] } | { ok: false; reason: "too_many_chunks" | "word_too_large" } {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start;
    let bytes = 0;
    while (end < text.length) {
      const point = text.codePointAt(end);
      if (point === undefined) break;
      const size = point <= 0x7f ? 1 : point <= 0x7ff ? 2 : point <= 0xffff ? 3 : 4;
      if (bytes + size > DIGEST_CHUNK_MAX_BYTES) break;
      bytes += size;
      end += point > 0xffff ? 2 : 1;
    }
    if (end < text.length) {
      const window = text.slice(start, end);
      const paragraphs = [...window.matchAll(/\r?\n[\t ]*\r?\n/g)];
      const paragraph = paragraphs.at(-1);
      const paragraphEnd = paragraph ? paragraph.index + paragraph[0].length : 0;
      if (paragraphEnd > 0 && new TextEncoder().encode(window.slice(0, paragraphEnd)).length >= DIGEST_CHUNK_MAX_BYTES * 0.9) {
        end = start + paragraphEnd;
      } else if (!/\s/u.test(text.slice(end - 1, end)) && !/\s/u.test(text.slice(end, end + 1))) {
        const boundary = [...window.matchAll(/\s+/gu)].at(-1);
        if (!boundary) return { ok: false, reason: "word_too_large" };
        end = start + boundary.index + boundary[0].length;
      }
    }
    chunks.push(text.slice(start, end));
    if (chunks.length > DIGEST_CHUNKS_MAX) return { ok: false, reason: "too_many_chunks" };
    start = end;
  }
  return { ok: true, chunks };
}

export function mergeDigests(digests: StructureDigest[]): StructureDigest {
  const names = new Map<string, StructureDigest["names"][number]>();
  for (const digest of digests) {
    for (const entry of digest.names) {
      const key = entry.name.trim().toLowerCase().replace(/\s+/g, " ");
      const first = names.get(key);
      if (first) first.mentions += entry.mentions;
      else names.set(key, { ...entry });
    }
  }
  return {
    names: [...names.values()].sort((a, b) => b.mentions - a.mentions).slice(0, 60),
    statedGoal: digests.find((digest) => digest.statedGoal !== null)?.statedGoal ?? null,
    arc: digests.find((digest) => digest.arc !== null)?.arc ?? null,
  };
}

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
  const entry = raw as { id?: unknown; cut?: unknown; title?: unknown; why?: unknown; regions?: unknown };
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
    if (/['’]s$/i.test(name)) return { ok: false, reason: "possessive_region_name" };
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
  | { status: "ok"; structures: SuggestedStructure[]; shortfall: string | null; lostChunks: number }
  | { status: "refused"; reason: InputRefusal }
  | { status: "failed"; reason: string; lostChunks: number };

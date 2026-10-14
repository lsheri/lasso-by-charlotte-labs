/**
 * CARRY-1. Evidence that a chat produced a file, counted against the
 * attachments that actually arrived.
 *
 * This describes a push, never a person. The count must never be
 * aggregated into a per-person rate or shown in any workspace view at
 * individual grain. Provenance, never proportion.
 */

export const FILE_EVIDENCE_EXTENSIONS = [
  "pptx",
  "docx",
  "xlsx",
  "pdf",
  "key",
  "numbers",
  "pages",
  "csv",
  "odp",
  "odt",
  "ods",
] as const;

const MAX_MESSAGES = 200;
const MAX_CHARS = 200_000;
const MAX_RESULTS = 20;
const MAX_NAME = 120;

const FILE_PATTERN =
  /\b\w[\w .\-()]{0,120}\.(pptx|docx|xlsx|pdf|key|numbers|pages|csv|odp|odt|ods)\b/gi;

function looksLinked(text: string, start: number): boolean {
  const before = text.slice(Math.max(0, start - 10), start);
  if (before.includes("://")) return true;
  // Preceded by "/" with no whitespace in between.
  for (let i = start - 1; i >= 0; i--) {
    const c = text[i]!;
    if (c === "/") return true;
    if (/\s/.test(c)) return false;
  }
  return false;
}

export function findFileEvidence(messageTexts: string[]): string[] {
  const found: string[] = [];
  if (!Array.isArray(messageTexts)) return found;
  const seen = new Set<string>();
  for (const raw of messageTexts.slice(0, MAX_MESSAGES)) {
    if (typeof raw !== "string") continue;
    const text = raw.slice(0, MAX_CHARS);
    FILE_PATTERN.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FILE_PATTERN.exec(text)) !== null) {
      const name = m[0].trim();
      if (name.length === 0 || name.length > MAX_NAME) continue;
      if (looksLinked(text, m.index)) continue;
      const lower = name.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      found.push(lower);
      if (found.length >= MAX_RESULTS) return found;
    }
  }
  return found;
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/[_\-.]/g, " ").replace(/\s+/g, " ").trim();
}

function stemOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return normalise(dot > 0 ? filename.slice(0, dot) : filename);
}

export function countCarryGaps(input: {
  messageTexts: string[];
  attachmentTitles: string[];
  attachmentFilenames: string[];
}): { gaps: number; evidence: "none" | "filename" } {
  try {
    if (!input || !Array.isArray(input.messageTexts)) return { gaps: 0, evidence: "none" };
    const clean = (xs: unknown) =>
      Array.isArray(xs)
        ? xs.filter((x): x is string => typeof x === "string").map((x) => x.trim().toLowerCase())
        : [];
    const filenames = clean(input.attachmentFilenames);
    const titles = clean(input.attachmentTitles);
    const titleStems = titles.map(normalise);
    let gaps = 0;
    for (const name of findFileEvidence(input.messageTexts)) {
      const n = name.trim();
      const stem = stemOf(n);
      const matched =
        filenames.includes(n) ||
        titles.includes(n) ||
        titles.some((t) => t.includes(n)) ||
        (stem.length > 0 && titleStems.includes(stem));
      if (!matched) gaps++;
    }
    return { gaps, evidence: gaps > 0 ? "filename" : "none" };
  } catch {
    return { gaps: 0, evidence: "none" };
  }
}

export function carryGapBucket(n: number): "0" | "1" | "2-5" | "6+" {
  if (n <= 0) return "0";
  if (n === 1) return "1";
  if (n <= 5) return "2-5";
  return "6+";
}

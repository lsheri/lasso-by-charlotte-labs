/**
 * Red pen (firm brain phase 1, PR 6 of the buyer order): every checkable claim in a deliverable, checked against the
 * board's own sources. Claims are exact snippets of the deliverable; a source counts only when its quote is found
 * word for word (the span provenance honesty gate). Sourced is an exact match, Weak a paraphrase, Unsupported nothing.
 */

import { containsVerbatim, sectionsFromText } from "@/lib/span-provenance-shared";

export const RED_PEN_CLAIMS_MAX = 40;
export const RED_PEN_BATCH = 8;
/** Sources read per batch, ranked by words shared with the batch's claims. */
export const RED_PEN_SOURCES_PER_BATCH = 8;
export const RED_PEN_SOURCE_CHARS = 12_000;

export type RedPenGrade = "sourced" | "weak" | "unsupported";

export type RedPenClaim = {
  /** Exact text from the deliverable. */
  snippet: string;
  /** Slide or section number, 1 based, or null when the text has no sections. */
  slide: number | null;
  grade: RedPenGrade;
  sourceItemId: string | null;
  sourceTitle: string | null;
  quote: string | null;
  note: string;
};

export type RedPenResult = {
  itemId: string;
  checkedAt: string;
  claims: RedPenClaim[];
  sourcesRead: number;
  counts: Record<RedPenGrade, number>;
};

export const RED_PEN_COPY = {
  menu: "Red pen",
  title: "Red pen",
  intro: "Checks every headline, number and recommendation in this deliverable against the sources on this board. A source counts only when its words are found in it.",
  run: "Check this deliverable",
  rerun: "Check again",
  running: "Checking claims against this board's sources",
  error: "That did not work. Try again.",
  none: "No checkable claims found.",
  unsupported: "Unsupported",
  weak: "Weak",
  sourced: "Sourced",
  unsupportedHint: "Nothing on this board says this.",
  weakHint: "A source says something close, not the same.",
  slide: (n: number) => `Slide ${n}`,
  checked: (date: string) => `Checked ${date}`,
  summary: (counts: Record<RedPenGrade, number>) => `${counts.unsupported} unsupported, ${counts.weak} weak, ${counts.sourced} sourced`,
  close: "Close",
} as const;

export const RED_PEN_ORDER: RedPenGrade[] = ["unsupported", "weak", "sourced"];

/** The claims the model listed that really are in the deliverable, with the slide each sits on, no repeats. */
export function checkExtracted(raw: unknown, deliverable: string): { snippet: string; slide: number | null }[] {
  const list = Array.isArray(raw) ? raw : [];
  const sections = sectionsFromText(deliverable);
  const out: { snippet: string; slide: number | null }[] = [];
  const seen = new Set<string>();
  for (const entry of list) {
    const snippet = typeof entry === "string" ? entry : entry && typeof entry === "object" ? (entry as Record<string, unknown>)["text"] : null;
    if (typeof snippet !== "string") continue;
    const trimmed = snippet.trim();
    if (trimmed.length < 12 || !containsVerbatim(deliverable, trimmed) || seen.has(trimmed.toLowerCase())) continue;
    seen.add(trimmed.toLowerCase());
    const section = sections.find((entry) => containsVerbatim(entry.text, trimmed));
    out.push({ snippet: trimmed, slide: sections.length > 1 && section ? section.index : null });
    if (out.length >= RED_PEN_CLAIMS_MAX) break;
  }
  return out;
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "will", "have", "has", "our", "their", "they", "its", "into", "than", "not", "but", "per", "all", "can", "who", "what", "which"]);

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9$%.]{3,}/g)?.filter((word) => !STOP.has(word)) ?? []);
}

/** The sources most likely to hold these claims: ranked by distinct words shared with them. */
export function rankSources<T extends { text: string }>(claims: readonly string[], sources: readonly T[], keep: number): T[] {
  const wanted = words(claims.join(" "));
  return sources
    .map((source, index) => {
      const have = words(source.text);
      let score = 0;
      for (const word of wanted) if (have.has(word)) score += 1;
      return { source, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, keep)
    .map((entry) => entry.source);
}

export function gradeOf(status: "exact" | "paraphrase" | "unsourced"): RedPenGrade {
  return status === "exact" ? "sourced" : status === "paraphrase" ? "weak" : "unsupported";
}

export function countGrades(claims: readonly RedPenClaim[]): Record<RedPenGrade, number> {
  const counts: Record<RedPenGrade, number> = { sourced: 0, weak: 0, unsupported: 0 };
  for (const claim of claims) counts[claim.grade] += 1;
  return counts;
}

/** Deliverables the red pen reads. */
export function canRedPen(type: string | null | undefined): boolean {
  return type === "deck" || type === "document" || type === "sheet";
}

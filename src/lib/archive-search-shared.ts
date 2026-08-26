/**
 * Pass 124: the learning archive's search. Browser safe half: the copy, the
 * shapes, and the honesty gate that decides which of the model's matches
 * survive. Quotation marks are only allowed around strings that really are in
 * the corpus, and an id the corpus does not know is dropped, never repaired.
 */

import { containsVerbatim } from "@/lib/span-provenance-shared";

export const ARCHIVE_TITLE = "THE ARCHIVE";
export const ARCHIVE_SUBHEAD =
  "Shipped work from across the firm. Open anything to walk the process behind it.";
export const ARCHIVE_TEASER_LABEL = "FROM THE FIRM ARCHIVE";
export const ARCHIVE_BROWSE_LINK = "BROWSE THE ARCHIVE →";
export const ARCHIVE_NAV_LABEL = "The archive";

export const ARCHIVE_PLACEHOLDER =
  'ASK THE ARCHIVE — "HOW DO PEOPLE BUILD PRICING DECKS HERE?"';
export const ARCHIVE_SKIP_LABEL = "SKIP →";
export const ARCHIVE_BACK_LABEL = "← BACK TO RESULTS";
export const ARCHIVE_BROWSE_PILE_LABEL = "BROWSE THE PILE →";
export const ARCHIVE_WHY_PREFIX = "WHY: ";

/** Below this the archive cannot honestly answer, and no model is called. */
export const ARCHIVE_MIN_ITEMS = 3;
export const ARCHIVE_TOO_SMALL_LINE =
  "THE ARCHIVE IS STILL SMALL — FEWER THAN THREE PIECES. BROWSE THE PILE BELOW INSTEAD.";
export const ARCHIVE_NO_MATCH_LINE =
  "NOTHING IN THE ARCHIVE MATCHES THAT YET. TRY THE PILE — SOMETHING ADJACENT MAY HELP.";

/** Never pad a thin answer with weak matches. */
export const ARCHIVE_MATCH_CAP = 6;

export type ArchiveMatch = { work_item_id: string; why: string };

export type ArchiveSearchResult = {
  matches: ArchiveMatch[];
  best_match_id: string | null;
  /** True only when the archive was too small to ask. */
  too_small: boolean;
};

/** One shipped piece as the model reads it, and as validation checks it. */
export type ArchiveCorpusEntry = {
  work_item_id: string;
  title: string;
  engagement_title: string | null;
  brief: string | null;
  /** Flattened Work Artifact section text, empty when no artifact exists. */
  artifact_text: string;
};

export const ARCHIVE_SEARCH_PROMPT = `You are helping a colleague learn from work already shipped to this firm's archive.

You are given a question and the archive: each piece with its id, its title, the engagement it belongs to, the brief where one exists, and the text of its Work Artifact where one was written.

Return STRICT JSON and nothing else:
{ "matches": [{ "work_item_id": string, "why": string }], "best_match_id": string | null }

RULES:
- Only ever name a work_item_id that appears in the supplied archive. Never invent a piece of work, a person, a client or a process detail.
- "why" is one sentence of evidence about why this piece helps with the question. Use quotation marks ONLY around text copied character for character from the supplied archive. Everything else is unquoted.
- No superlatives, no praise, no ranking language, nothing about who made it or how much anyone has shipped.
- Return only pieces that genuinely help. An empty matches list is an honest answer and is better than padding.
- best_match_id is the single most useful piece, or null when there is none.
- Never use an em dash.`;

export function buildArchiveMessages(
  question: string,
  corpus: readonly ArchiveCorpusEntry[],
): { system: string; user: string } {
  const blocks = corpus
    .map((entry) =>
      [
        `PIECE ${entry.work_item_id}`,
        `TITLE: ${entry.title}`,
        entry.engagement_title ? `ENGAGEMENT: ${entry.engagement_title}` : null,
        entry.brief ? `BRIEF: ${entry.brief}` : null,
        entry.artifact_text ? `WORK ARTIFACT:\n${entry.artifact_text}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");
  return {
    system: ARCHIVE_SEARCH_PROMPT,
    user: `QUESTION: ${question}\n\nTHE ARCHIVE:\n\n${blocks}`,
  };
}

/** Every quoted run inside a why line, in order. */
export function quotedRuns(why: string): string[] {
  const runs: string[] = [];
  const pattern = /"([^"]+)"|\u201c([^\u201d]+)\u201d/g;
  let hit = pattern.exec(why);
  while (hit) {
    runs.push((hit[1] ?? hit[2] ?? "").trim());
    hit = pattern.exec(why);
  }
  return runs.filter((run) => run.length > 0);
}

/**
 * The honesty gate. A quote that is not verbatim in the piece it is offered
 * against loses its quotation marks rather than reading true and not being so.
 */
export function groundWhy(why: string, corpusText: string): string {
  let out = why.trim();
  for (const run of quotedRuns(out)) {
    if (containsVerbatim(corpusText, run)) continue;
    out = out.split(`"${run}"`).join(run).split(`\u201c${run}\u201d`).join(run);
  }
  return out;
}

/**
 * Validation, server side and testable: unknown ids are dropped, duplicates
 * collapse, the list is clamped, and every why line is grounded in the piece
 * it belongs to.
 */
export function validateArchiveMatches(
  raw: unknown,
  corpus: readonly ArchiveCorpusEntry[],
): { matches: ArchiveMatch[]; best_match_id: string | null } {
  const input = (raw ?? {}) as { matches?: unknown; best_match_id?: unknown };
  const byId = new Map(corpus.map((entry) => [entry.work_item_id, entry] as const));
  const seen = new Set<string>();
  const matches: ArchiveMatch[] = [];

  for (const item of Array.isArray(input.matches) ? input.matches : []) {
    const row = (item ?? {}) as { work_item_id?: unknown; why?: unknown };
    const id = typeof row.work_item_id === "string" ? row.work_item_id : "";
    const entry = byId.get(id);
    if (!entry || seen.has(id)) continue;
    const text = [entry.title, entry.engagement_title ?? "", entry.brief ?? "", entry.artifact_text]
      .filter(Boolean)
      .join("\n");
    const why = groundWhy(typeof row.why === "string" ? row.why : "", text).slice(0, 300);
    if (!why) continue;
    seen.add(id);
    matches.push({ work_item_id: id, why });
    if (matches.length >= ARCHIVE_MATCH_CAP) break;
  }

  const claimed = typeof input.best_match_id === "string" ? input.best_match_id : null;
  const best = claimed && seen.has(claimed) ? claimed : (matches[0]?.work_item_id ?? null);
  return { matches, best_match_id: best };
}

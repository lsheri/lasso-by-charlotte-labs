/**
 * Pass 138: Past work. The browser safe half of the "find shipped work like
 * mine" search: the copy, the shapes, the prompt, and the validation that
 * keeps the model inside the candidate set it was given.
 *
 * Shipped work is the only thing this feature ever reads. It is work a
 * colleague chose to send to the firm, so it is consented by construction.
 */

export const PAST_WORK_NAV_LABEL = "Past work";
export const PAST_WORK_GROUP_LABEL = "Firm";

export const PAST_WORK_PLACEHOLDER = "What are you working on?";
export const PAST_WORK_HINT =
  "Describe the work and Lasso finds shipped work like it, with why it matches.";
export const PAST_WORK_EMPTY_LINE =
  "Nothing shipped yet looks like this. The archive grows as work ships.";
export const PAST_WORK_FOOTER_LINE = "Reads shipped work only.";
export const PAST_WORK_SUBMIT_LABEL = "Find work like it";
export const PAST_WORK_WHY_LABEL = "WHY THIS IS LIKE YOUR WORK";
export const PAST_WORK_LOOK_LABEL = "WHAT TO LOOK AT";
export const PAST_WORK_RESULTS_LABEL = "SHIPPED WORK LIKE IT";

/** One event name for this whole feature. */
export const PAST_WORK_EVENT = "archive.search" as const;

/** At most five matches come back, however many the model offers. */
export const PAST_WORK_MATCH_CAP = 5;

/** One shipped piece, as the model reads it and as validation checks it. */
export type PastWorkCandidate = {
  work_item_id: string;
  title: string;
  /** The work item type, shown to the model as its kind. */
  kind: string;
  /** The owner's deliverable kind, when one was chosen. */
  deliverable_kind: string | null;
  engagement_id: string | null;
  engagement_code: string | null;
  engagement_title: string | null;
  client_label: string | null;
  brief: string | null;
  /** The work item extract summary, when one was written. */
  summary: string | null;
};

export type PastWorkMatch = {
  work_item_id: string;
  /** One sentence: why this shipped piece is like the described work. */
  why: string;
  /** One sentence pointing at something concrete to open. */
  look_at: string;
};

export type PastWorkSearchResult = {
  matches: PastWorkMatch[];
  result_count: number;
  had_results: boolean;
};

export const PAST_WORK_PROMPT = `You are helping a colleague find work this firm has already shipped that resembles the work they are about to do.

You are given a description of their work and a list of shipped pieces. Each piece has an id, a title, a deliverable kind, the engagement it belongs to, the engagement brief where one exists, and a short summary where one exists.

Return STRICT JSON and nothing else:
{ "matches": [{ "work_item_id": string, "why": string, "look_at": string }] }

RULES:
- Return at most 5 matches, best first. Fewer is better than padding.
- Only ever name a work_item_id that appears in the supplied list. Never invent a piece of work, a person, a client, or a detail.
- "why" is one sentence saying how this shipped piece is like the described work.
- "look_at" is one sentence naming one concrete thing to open: the brief, the deliverable itself, or the work artifact behind it.
- Say nothing about who made it, how good it is, or how much anyone has shipped. No praise, no ranking language.
- An empty matches list is an honest answer.
- Never use an em dash.`;

export function buildPastWorkMessages(
  description: string,
  candidates: readonly PastWorkCandidate[],
): { system: string; user: string } {
  const blocks = candidates
    .map((candidate) =>
      [
        `PIECE ${candidate.work_item_id}`,
        `TITLE: ${candidate.title}`,
        `KIND: ${candidate.kind}`,
        candidate.engagement_title
          ? `ENGAGEMENT: ${[candidate.engagement_code, candidate.engagement_title]
              .filter(Boolean)
              .join(" ")}`
          : null,
        candidate.client_label ? `CLIENT: ${candidate.client_label}` : null,
        candidate.brief ? `BRIEF: ${candidate.brief}` : null,
        candidate.summary ? `SUMMARY: ${candidate.summary}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .join("\n\n---\n\n");

  return {
    system: PAST_WORK_PROMPT,
    user: `THE WORK THEY DESCRIBED: ${description}\n\nSHIPPED WORK:\n\n${blocks}`,
  };
}

function oneSentence(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\u2014/g, ", ").slice(0, 240) : "";
}

/**
 * Ids the candidate set does not know are dropped, never repaired. Duplicates
 * collapse, and the list is clamped to five.
 */
export function validatePastWorkMatches(
  raw: unknown,
  candidates: readonly PastWorkCandidate[],
): PastWorkMatch[] {
  const input = (raw ?? {}) as { matches?: unknown };
  const known = new Set(candidates.map((candidate) => candidate.work_item_id));
  const seen = new Set<string>();
  const matches: PastWorkMatch[] = [];

  for (const item of Array.isArray(input.matches) ? input.matches : []) {
    const row = (item ?? {}) as Record<string, unknown>;
    const id = typeof row["work_item_id"] === "string" ? (row["work_item_id"] as string) : "";
    if (!known.has(id) || seen.has(id)) continue;
    const why = oneSentence(row["why"]);
    const lookAt = oneSentence(row["look_at"]);
    if (!why) continue;
    seen.add(id);
    matches.push({ work_item_id: id, why, look_at: lookAt });
    if (matches.length >= PAST_WORK_MATCH_CAP) break;
  }

  return matches;
}

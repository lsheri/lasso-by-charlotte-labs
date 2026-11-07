/**
 * Unit 2: how Ask answers refer to turns. The model is handed turns labelled
 * in plain words it can cite, told never to print internal tag names, and any
 * tag that still slips through is rewritten before the answer is kept.
 * Pure, so every rule here is testable without a model.
 */

export type TurnRef = { work_item_id: string; turn_no: number; label: string };

/** The internal tag shapes item text and turn reads have always used. */
const TAG_LINE = /^TURN (\d+)(?: ·|:)? (USER|ASSISTANT|TOOL)(?::[ \t]*|[ \t]*\n)/gm;
/** Any internal tag appearing in prose. */
export const RAW_TURN_TAG = /TURN \d+ (?:·\s*)?(?:USER|ASSISTANT|TOOL)\b/;
const RAW_TURN_TAG_G = /\bTURN (\d+) (?:·\s*)?(?:USER|ASSISTANT|TOOL)\b:?/g;

export const TURN_CITATION_RULE =
  'HOW TO REFER TO TURNS: conversations are shown with labels like "(turn 5, you said)" and "(turn 6, the assistant replied)". When you point at a turn, name the conversation by its title and the turn number in plain words, for example: in "Board charter options", turn 6. Never say you cannot link, have no link, or cannot provide a link. The product attaches the link to every cited item and turn. Never print internal tag names such as TURN 5 USER or TURN 6 ASSISTANT.';

function roleWords(role: string): string {
  if (role === "USER") return "you said";
  if (role === "ASSISTANT") return "the assistant replied";
  return "a tool returned";
}

/** Relabels "TURN 5 USER: ..." and "TURN 5 · USER\n..." as "(turn 5, you said) ...". */
export function naturalTurnLabels(text: string): string {
  return text.replace(
    TAG_LINE,
    (_m, n: string, role: string) => `(turn ${n}, ${roleWords(role)}) `,
  );
}

/** The safety net: a tag that reaches an answer is rewritten as "turn N". */
export function stripTurnTags(answer: string): string {
  return answer.replace(RAW_TURN_TAG_G, (_m, n: string) => `turn ${n}`);
}

/** Turn numbers a text actually contains, from either label shape. */
export function turnNumbersIn(text: string): number[] {
  const found = [
    ...[...text.matchAll(/^TURN (\d+) /gm)].map((m) => Number(m[1])),
    ...[...text.matchAll(/^\(turn (\d+), /gm)].map((m) => Number(m[1])),
  ];
  return found;
}

/** Lowercase words only: punctuation and dashes become single spaces. */
function titleKey(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * The turns an answer cites, as work item id and turn number. A citation is
 * tied to the conversation whose title is named nearest before it in the same
 * paragraph; with one conversation in play, to that one. Nothing is guessed
 * beyond that.
 */
export function extractTurnRefs(
  answer: string,
  conversations: readonly { id: string; title: string }[],
  max = 12,
): TurnRef[] {
  const refs: TurnRef[] = [];
  const seen = new Set<string>();
  const usable = conversations
    .filter((c) => c.id && c.title.trim().length > 0)
    .map((c) => ({ ...c, key: titleKey(c.title) }))
    .filter((c) => c.key.length > 0);
  if (usable.length === 0) return refs;
  for (const paragraph of answer.split(/\n\s*\n/)) {
    // FIX-1: titles are matched on their words, not their punctuation. The
    // model rewrites "A — B" as "A, B" (house style bans the dash), and a
    // failed match let a turn attach to the previous chat named in the paragraph.
    const whole = titleKey(paragraph);
    for (const match of paragraph.matchAll(
      /\bturns? (\d{1,4})(?:\s*(?:-|\u2013|to|and)\s*(\d{1,4}))?/gi,
    )) {
      const before = titleKey(paragraph.slice(0, match.index ?? 0));
      let best: { id: string; title: string; key: string } | null = null;
      let bestEnd = -1;
      for (const c of usable) {
        const idx = before.lastIndexOf(c.key);
        if (idx < 0) continue;
        // Nearest title wins; when one title ends inside another, the longer one.
        const end = idx + c.key.length;
        if (end > bestEnd || (end === bestEnd && best && c.key.length > best.key.length)) {
          best = c;
          bestEnd = end;
        }
      }
      if (!best) best = usable.find((c) => whole.includes(c.key)) ?? null;
      if (!best && usable.length === 1) best = usable[0]!;
      if (!best) continue;
      const nums = [Number(match[1])];
      if (match[2]) nums.push(Number(match[2]));
      for (const n of nums) {
        if (!Number.isFinite(n) || n < 1) continue;
        const key = `${best.id}:${n}`;
        if (seen.has(key)) continue;
        seen.add(key);
        refs.push({ work_item_id: best.id, turn_no: n, label: `Turn ${n} in ${best.title}` });
        if (refs.length >= max) return refs;
      }
    }
  }
  return refs;
}

/** TOTAL-2: a citation the model returned, as stored on the answer's manifest. */
export type StoredCitation = { item_id: string | null; turn_no: number | null; text: string };

/**
 * Citations that land on a conversation turn become turn links beside the
 * answer. When there are any, they replace the refs found in the prose
 * (FIX-1); with none, the prose refs stand. A citation on a file carries no
 * turn and is rendered by the trail.
 */
export function turnRefsFromCitations(
  citations: readonly StoredCitation[] | null | undefined,
  conversations: readonly { id: string; title: string }[],
  existing: readonly TurnRef[] = [],
  max = 12,
): TurnRef[] {
  // FIX-1: when the model cited a turn, the chips come from citations alone.
  // Prose refs are only the fallback for an answer with no turn citations.
  const out: TurnRef[] = [];
  const seen = new Set<string>();
  const titles = new Map(conversations.map((c) => [c.id, c.title]));
  for (const c of citations ?? []) {
    if (!c.item_id || typeof c.turn_no !== "number") continue;
    const title = titles.get(c.item_id);
    if (!title) continue;
    const key = `${c.item_id}:${c.turn_no}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ work_item_id: c.item_id, turn_no: c.turn_no, label: `${title}, turn ${c.turn_no}` });
    if (out.length >= max) break;
  }
  return out.length > 0 ? out : [...existing].slice(0, max);
}

/** Reads the stored citations off a manifest value without trusting its shape. */
export function citationsFromManifest(value: unknown): StoredCitation[] {
  if (!value || typeof value !== "object") return [];
  const raw = (value as { citations?: unknown }).citations;
  if (!Array.isArray(raw)) return [];
  const out: StoredCitation[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { item_id?: unknown; turn_no?: unknown; text?: unknown };
    out.push({
      item_id: typeof e.item_id === "string" ? e.item_id : null,
      turn_no: typeof e.turn_no === "number" ? e.turn_no : null,
      text: typeof e.text === "string" ? e.text : "",
    });
  }
  return out;
}

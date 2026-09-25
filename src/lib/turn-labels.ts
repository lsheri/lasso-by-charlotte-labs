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
  'HOW TO REFER TO TURNS: conversations are shown with labels like "(turn 5, you said)" and "(turn 6, the assistant replied)". When you point at a turn, name the conversation by its title and the turn number in plain words, for example: in "Board charter options", turn 6. Never print internal tag names such as TURN 5 USER or TURN 6 ASSISTANT.';

function roleWords(role: string): string {
  if (role === "USER") return "you said";
  if (role === "ASSISTANT") return "the assistant replied";
  return "a tool returned";
}

/** Relabels "TURN 5 USER: ..." and "TURN 5 · USER\n..." as "(turn 5, you said) ...". */
export function naturalTurnLabels(text: string): string {
  return text.replace(TAG_LINE, (_m, n: string, role: string) => `(turn ${n}, ${roleWords(role)}) `);
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
  const usable = conversations.filter((c) => c.id && c.title.trim().length > 0);
  if (usable.length === 0) return refs;
  for (const paragraph of answer.split(/\n\s*\n/)) {
    const lower = paragraph.toLowerCase();
    for (const match of paragraph.matchAll(/\bturns? (\d{1,4})(?:\s*(?:-|\u2013|to|and)\s*(\d{1,4}))?/gi)) {
      const at = match.index ?? 0;
      let best: { id: string; title: string } | null = null;
      let bestAt = -1;
      for (const c of usable) {
        const idx = lower.lastIndexOf(c.title.toLowerCase(), at);
        if (idx >= 0 && idx > bestAt) {
          best = c;
          bestAt = idx;
        }
      }
      if (!best) best = usable.find((c) => lower.includes(c.title.toLowerCase())) ?? null;
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

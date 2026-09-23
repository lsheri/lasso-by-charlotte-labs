/**
 * P4. Decisions carried by a conversation push. Pure helpers only: parsing,
 * position-to-turn resolution, dedupe and the inbox rule. The push never
 * confirms anything; every accepted decision lands as a draft.
 */

export const MAX_PUSH_DECISIONS = 20;

export type IncomingDecision = {
  situation: string;
  call_text: string;
  why: string | null;
  cites: number[];
};

export type DecisionOutcome = "drafted" | "unchanged" | "skipped" | "held";

export type DecisionReceipt = {
  situation: string;
  call_text: string;
  outcome: DecisionOutcome;
  reason?: string;
  cites: number[];
};

export const DECISION_SKIPPED_REASON = "cites a position not yet stored";
export const DECISION_HELD_REASON =
  "decisions are recorded when the conversation is placed on a board";

/** Parse decisions[]; any invalid entry rejects the whole call. */
export function parsePushDecisions(
  raw: unknown,
): { ok: true; decisions: IncomingDecision[] } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, decisions: [] };
  if (!Array.isArray(raw)) return { ok: false, error: "decisions must be an array" };
  if (raw.length > MAX_PUSH_DECISIONS) {
    return { ok: false, error: `Too many decisions (${raw.length}). Max is ${MAX_PUSH_DECISIONS}.` };
  }
  const out: IncomingDecision[] = [];
  for (const [index, entry] of raw.entries()) {
    const d = (entry && typeof entry === "object" ? entry : {}) as Record<string, unknown>;
    const situation = typeof d["situation"] === "string" ? d["situation"].trim() : "";
    const call = typeof d["call_text"] === "string" ? d["call_text"].trim() : "";
    if (!situation || !call) {
      return { ok: false, error: `decisions[${index}] needs a non-blank situation and call_text` };
    }
    const cites = d["cites"];
    if (!Array.isArray(cites) || cites.length === 0) {
      return { ok: false, error: `decisions[${index}] must cite at least one message position` };
    }
    if (!cites.every((c) => typeof c === "number" && Number.isInteger(c) && c > 0)) {
      return { ok: false, error: `decisions[${index}].cites must be positive integers` };
    }
    const why = typeof d["why"] === "string" && d["why"].trim() ? d["why"].trim() : null;
    out.push({ situation, call_text: call, why, cites: [...new Set(cites as number[])] });
  }
  return { ok: true, decisions: out };
}

/** Map cited positions to stored turn ids; null when any position is not stored. */
export function resolveCitedTurns(
  cites: number[],
  turnIdByPosition: ReadonlyMap<number, string>,
): string[] | null {
  const ids: string[] = [];
  for (const pos of cites) {
    const turnId = turnIdByPosition.get(pos);
    if (!turnId) return null;
    ids.push(turnId);
  }
  return ids;
}

export type DecisionSrcRef = { work_item_id: string; turn_id: string | null };

function srcKey(srcs: readonly DecisionSrcRef[]): string {
  return srcs
    .map((s) => `${s.work_item_id}:${s.turn_id ?? ""}`)
    .sort()
    .join("|");
}

/** Same call_text and the same set of sources as an existing draft or confirmed decision. */
export function isDuplicateDecision(
  candidate: { call_text: string; srcs: readonly DecisionSrcRef[] },
  existing: readonly { call_text: string; srcs: unknown; status: string }[],
): boolean {
  const key = srcKey(candidate.srcs);
  return existing.some(
    (row) =>
      (row.status === "draft" || row.status === "confirmed") &&
      row.call_text.trim() === candidate.call_text.trim() &&
      Array.isArray(row.srcs) &&
      srcKey(row.srcs as DecisionSrcRef[]) === key,
  );
}

/** Nothing is written unless the conversation landed on a board. */
export function decisionsWritable(target: string, placeResolved: boolean): boolean {
  return target === "workboard" && placeResolved;
}

export function decisionsLine(receipts: readonly DecisionReceipt[]): string {
  if (receipts.length === 0) return "";
  const order: DecisionOutcome[] = ["drafted", "unchanged", "held", "skipped"];
  const parts = order
    .map((o) => [o, receipts.filter((r) => r.outcome === o).length] as const)
    .filter(([, n]) => n > 0)
    .map(([o, n]) => `${n} ${o}`);
  return `Decisions: ${parts.join(", ")}.`;
}

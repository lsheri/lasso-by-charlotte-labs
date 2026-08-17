/**
 * STRUCTURED HANDOFFS.
 *
 * A deliverable-scoped analysis may end its answer with one fenced block that
 * carries the checkable items it just made in prose. The block is stripped
 * server side and never reaches a reader: the prose contract of every preset
 * is unchanged, and the block is only a draft list the OWNER may confirm.
 *
 * Nothing here writes anywhere. Every item is a draft until the person taps.
 */

export const HANDOFF_SENTINEL = "LASSO_HANDOFFS_V1";

/** The four handoff kinds, one per preset that emits them. */
export const HANDOFF_KINDS = [
  "open_checks",
  "decision_candidates",
  "departures",
  "check_results",
] as const;
export type HandoffKind = (typeof HANDOFF_KINDS)[number];

/**
 * Only these four presets emit handoffs. Person-shaped presets (ai_fluency_4d,
 * working_the_model) emit nothing, ever: nothing about a person flows anywhere.
 * what_recurs emits nothing this pass and what_fed_this already owns its own
 * confirm flow in the lineage drafter.
 */
export const HANDOFF_PRESETS: Record<string, HandoffKind> = {
  verification: "open_checks",
  decision_origin: "decision_candidates",
  still_on_brief: "departures",
  firm_checks: "check_results",
};

/** Presets that must never carry a handoff block, enforced server side. */
export const PERSON_SHAPED_PRESETS = ["ai_fluency_4d", "working_the_model"] as const;
export const NO_HANDOFF_PRESETS = [
  ...PERSON_SHAPED_PRESETS,
  "what_recurs",
  "what_fed_this",
] as const;

export type HandoffState = "draft" | "confirmed" | "discarded";

export type OpenCheckItem = {
  claim_quote: string;
  location: string;
  verdict: "nothing_visible" | "contradicted";
  suggested_check: string;
};

export type DecisionCandidateItem = {
  call: string;
  origin: string;
  what_it_decided: string;
  evidence_turn_id?: string;
  deliverable_location?: string;
};

export type DepartureItem = {
  class: "ADDED" | "DROPPED" | "CHANGED" | "REFRAMED";
  brief_quote: string;
  work_quote: string;
  entered_at: string;
  acknowledged: boolean;
};

export type CheckResultItem = {
  check_id: string;
  status: "addressed" | "partly" | "not_visible";
  evidence_quote: string;
};

export type HandoffFields =
  | OpenCheckItem
  | DecisionCandidateItem
  | DepartureItem
  | CheckResultItem;

export type HandoffItem = {
  /** Server minted. A model supplied id would collide across runs. */
  id: string;
  state: HandoffState;
  confirmed_at?: string;
  discarded_at?: string;
  fields: HandoffFields;
};

export type HandoffBlock = {
  v: 1;
  kind: HandoffKind;
  items: HandoffItem[];
};

/** Item cap per run, so one analysis can never flood the destinations. */
export const MAX_HANDOFF_ITEMS = 12;

const MAX_FIELD_CHARS = 1200;

function str(value: unknown, max = MAX_FIELD_CHARS): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : null;
}

/**
 * Per item validation. An item that does not validate is dropped; the rest are
 * kept. Nothing half parsed is ever stored.
 */
function validateItem(kind: HandoffKind, raw: unknown): HandoffFields | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (kind === "open_checks") {
    const claim_quote = str(row["claim_quote"]);
    const location = str(row["location"], 200);
    const verdict = oneOf(row["verdict"], ["nothing_visible", "contradicted"] as const);
    const suggested_check = str(row["suggested_check"], 400);
    if (!claim_quote || !location || !verdict || !suggested_check) return null;
    return { claim_quote, location, verdict, suggested_check };
  }
  if (kind === "decision_candidates") {
    const call = str(row["call"], 400);
    const origin = str(row["origin"], 400);
    const what_it_decided = str(row["what_it_decided"], 600);
    if (!call || !origin || !what_it_decided) return null;
    const evidence_turn_id = str(row["evidence_turn_id"], 120);
    const deliverable_location = str(row["deliverable_location"], 200);
    if (!evidence_turn_id && !deliverable_location) return null;
    return {
      call,
      origin,
      what_it_decided,
      ...(evidence_turn_id ? { evidence_turn_id } : {}),
      ...(deliverable_location ? { deliverable_location } : {}),
    };
  }
  if (kind === "departures") {
    const cls = oneOf(row["class"], ["ADDED", "DROPPED", "CHANGED", "REFRAMED"] as const);
    const brief_quote = str(row["brief_quote"]);
    const work_quote = str(row["work_quote"]);
    const entered_at = str(row["entered_at"], 200);
    if (!cls || !brief_quote || !work_quote || !entered_at) return null;
    return {
      class: cls,
      brief_quote,
      work_quote,
      entered_at,
      acknowledged: row["acknowledged"] === true,
    };
  }
  const check_id = str(row["check_id"], 120);
  const status = oneOf(row["status"], ["addressed", "partly", "not_visible"] as const);
  const evidence_quote = str(row["evidence_quote"]);
  if (!check_id || !status) return null;
  return { check_id, status, evidence_quote: evidence_quote ?? "" };
}

/** Where the sentinel fence begins in a piece of text, or -1. */
export function sentinelFenceStart(text: string): number {
  const marker = text.indexOf(HANDOFF_SENTINEL);
  if (marker === -1) return -1;
  const fence = text.lastIndexOf("```", marker);
  return fence === -1 ? -1 : fence;
}

export type StripResult = {
  /** The prose the reader sees. Never contains the fence. */
  prose: string;
  /** Null when there was no block, or the block did not validate. */
  block: Omit<HandoffBlock, "items"> & { items: HandoffFields[] } | null;
  /** Why nothing was stored, for health logging. Content free. */
  parse: "ok" | "none" | "malformed";
};

/**
 * Strip and parse the fenced tail. The fence is only removed when it carries
 * the sentinel AND parses AND at least one item validates. A fenced block that
 * is part of the answer itself (quoted code, for instance) has no sentinel and
 * is left exactly where it is.
 */
export function stripHandoffTail(text: string, kind: HandoffKind | null): StripResult {
  const start = sentinelFenceStart(text);
  if (start === -1) return { prose: text, block: null, parse: "none" };

  const prose = text.slice(0, start).trimEnd();
  const fenced = text.slice(start);
  const body = fenced.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  const jsonStart = body.indexOf("{");
  if (!kind || jsonStart === -1) return { prose, block: null, parse: "malformed" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(jsonStart));
  } catch {
    return { prose, block: null, parse: "malformed" };
  }
  const root = parsed as Record<string, unknown> | null;
  if (!root || typeof root !== "object") return { prose, block: null, parse: "malformed" };
  const rawItems = root[kind] ?? root["items"];
  if (!Array.isArray(rawItems)) return { prose, block: null, parse: "malformed" };

  const items = rawItems
    .slice(0, MAX_HANDOFF_ITEMS)
    .map((item) => validateItem(kind, item))
    .filter((item): item is HandoffFields => item !== null);
  if (items.length === 0) return { prose, block: null, parse: "malformed" };
  return { prose, block: { v: 1, kind, items }, parse: "ok" };
}

/**
 * The streaming holdback. Deltas pass straight through until a fence that
 * could be the sentinel tail begins; from there the text is buffered. If the
 * block never validates, or the stream ends mid fence, the buffer is flushed
 * as prose, so a reader can never lose an answer to this feature.
 */
export function createHoldback(emit: (delta: string) => void): {
  push: (delta: string) => void;
  end: (blockValidated: boolean) => void;
} {
  let held = "";
  /** Enough characters to tell a sentinel fence from an ordinary one. */
  const DECIDE_AT = 12 + HANDOFF_SENTINEL.length;

  return {
    push(delta: string) {
      held += delta;
      if (held.includes(HANDOFF_SENTINEL)) {
        // Release anything that arrived before the fence, then hold the rest.
        const start = sentinelFenceStart(held);
        if (start > 0) {
          emit(held.slice(0, start));
          held = held.slice(start);
        }
        return;
      }
      const fence = held.lastIndexOf("```");
      if (fence === -1) {
        emit(held);
        held = "";
        return;
      }
      const candidate = held.slice(fence);
      if (candidate.length < DECIDE_AT) {
        // Undecided: hold just the candidate, release everything before it.
        if (fence > 0) emit(held.slice(0, fence));
        held = candidate;
        return;
      }
      // Long enough to decide and no sentinel: an ordinary fence in the answer.
      emit(held);
      held = "";
    },
    end(blockValidated: boolean) {
      if (!held) return;
      if (!(blockValidated && held.includes(HANDOFF_SENTINEL))) emit(held);
      held = "";
    },
  };
}

/**
 * The tail instruction, appended to an analysis as a SEPARATE message block.
 * It never edits a preset's own prompt, and it says nothing about how the
 * prose should read: the eight presets keep their output contract exactly.
 */
export function tailInstruction(kind: HandoffKind): string {
  const shape: Record<HandoffKind, string> = {
    open_checks: `{"open_checks":[{"claim_quote":"<verbatim span from the work>","location":"<where it sits>","verdict":"nothing_visible|contradicted","suggested_check":"<the check a reviewer could run>"}]}`,
    decision_candidates: `{"decision_candidates":[{"call":"<the call that was made>","origin":"<where it came from>","what_it_decided":"<what it settled>","evidence_turn_id":"<turn number or id, or omit>","deliverable_location":"<where in the work, or omit>"}]}`,
    departures: `{"departures":[{"class":"ADDED|DROPPED|CHANGED|REFRAMED","brief_quote":"<verbatim span from the brief>","work_quote":"<verbatim span from the work>","entered_at":"<where it entered>","acknowledged":true}]}`,
    check_results: `{"check_results":[{"check_id":"<the check number from the CHECKS block>","status":"addressed|partly|not_visible","evidence_quote":"<verbatim span, or an empty string>"}]}`,
  };
  return [
    "AFTER your answer, and only after it is complete, append one fenced code block.",
    "The block is machine read and stripped before anyone sees the answer, so it must not change one word of the answer above it.",
    `The first line inside the fence is exactly ${HANDOFF_SENTINEL}.`,
    "The remaining lines are a single JSON object in this shape:",
    shape[kind],
    `List at most ${MAX_HANDOFF_ITEMS} items, drawn only from what your answer already established.`,
    "Every quote in the block is copied character for character from the work supplied to you. If you cannot copy it exactly, leave that item out.",
    "Introduce nothing in the block that your answer did not already say. If there is nothing to list, omit the fenced block entirely.",
  ].join("\n");
}

/** The verbatim spans inside one item, so they can face the same quote check. */
export function quoteFields(kind: HandoffKind, fields: HandoffFields): string[] {
  if (kind === "open_checks") return [(fields as OpenCheckItem).claim_quote];
  if (kind === "departures") {
    const f = fields as DepartureItem;
    return [f.brief_quote, f.work_quote];
  }
  if (kind === "check_results") {
    const q = (fields as CheckResultItem).evidence_quote;
    return q ? [q] : [];
  }
  return [];
}

/** Content free bucket for telemetry. */
export function handoffsBucket(n: number): "0" | "1-3" | "4-8" | "9+" {
  if (n <= 0) return "0";
  if (n <= 3) return "1-3";
  if (n <= 8) return "4-8";
  return "9+";
}

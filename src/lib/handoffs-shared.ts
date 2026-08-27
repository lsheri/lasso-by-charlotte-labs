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
 * what_fed_this already owns its own confirm flow in the lineage drafter.
 */
export const HANDOFF_PRESETS: Record<string, HandoffKind> = {
  verification: "open_checks",
  /** The thread scoped sibling. Same schema, anchored to a turn. */
  verification_thread: "open_checks",
  decision_origin: "decision_candidates",
  /** The thread scoped sibling. Same schema, anchored to a turn. */
  decision_origin_thread: "decision_candidates",
  still_on_brief: "departures",
  firm_checks: "check_results",
};


/** Presets that must never carry a handoff block, enforced server side. */
export const PERSON_SHAPED_PRESETS = ["ai_fluency_4d", "working_the_model"] as const;
export const NO_HANDOFF_PRESETS = [
  ...PERSON_SHAPED_PRESETS,
  // Retired, but old run rows still carry it.
  "what_recurs",
  "what_fed_this",
] as const;

export type HandoffState = "draft" | "confirmed" | "discarded";

export type OpenCheckItem = {
  claim_quote: string;
  location: string;
  verdict: "nothing_visible" | "contradicted" | "checked";
  suggested_check: string;
  /**
   * The turn the model produced the claim in. Optional for the deliverable
   * scoped run, required for the thread scoped one: ink has nowhere to land
   * without it.
   */
  evidence_turn_id?: string;
  /** Pass 128: the one line a person wrote about how they checked it. */
  self_check_note?: string;
  /** Pass 128: this item arrived already settled, from the run named here. */
  carried_from_run_id?: string;
};



/**
 * Where a call came from. Optional: an item that carries no class is read as
 * untraceable, and is never dropped for that alone.
 */
export const DECISION_ORIGIN_CLASSES = [
  "brief",
  "you",
  "model_accepted",
  "model_changed",
  "source",
  "untraceable",
] as const;
export type DecisionOriginClass = (typeof DECISION_ORIGIN_CLASSES)[number];

export type DecisionCandidateItem = {
  call: string;
  origin: string;
  what_it_decided: string;
  evidence_turn_id?: string;
  deliverable_location?: string;
  origin_class?: DecisionOriginClass;
  /** This item arrived already settled, from the run named here. */
  carried_from_run_id?: string;
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
 * A turn reference, reduced to the turn number it names. "TURN 4", "4",
 * "turn-4" all name turn 4; anything with no number names nothing.
 */
export function normalizeTurnRef(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = value.match(/\d{1,6}/);
  return match ? match[0].replace(/^0+(?=\d)/, "") : null;
}

/**
 * The anchoring rules for one parse. The thread scoped run requires a turn
 * reference that names a real model turn; the deliverable scoped run passes
 * nothing here and is unchanged.
 */
export type HandoffAnchorOptions = {
  requireEvidenceTurn?: boolean;
  /** Normalised references the run will accept. Model turns only. */
  allowedTurnRefs?: readonly string[];
};

/**
 * Per item validation. An item that does not validate is dropped; the rest are
 * kept. Nothing half parsed is ever stored.
 */
export function validateItem(
  kind: HandoffKind,
  raw: unknown,
  opts: HandoffAnchorOptions = {},
): HandoffFields | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  if (kind === "open_checks") {
    const claim_quote = str(row["claim_quote"]);
    const location = str(row["location"], 200);
    const verdict = oneOf(row["verdict"], ["nothing_visible", "contradicted", "checked"] as const);
    const suggested_check = str(row["suggested_check"], 400);
    if (!claim_quote || !location || !verdict || !suggested_check) return null;
    const turnRef = normalizeTurnRef(str(row["evidence_turn_id"], 120));
    const allowed = opts.allowedTurnRefs;
    // A finding with no anchor, or an anchor that names no model turn in this
    // conversation, has nowhere to put its ink. It is dropped, never repaired.
    if (opts.requireEvidenceTurn) {
      if (!turnRef) return null;
      if (allowed && !allowed.includes(turnRef)) return null;
    }
    return {
      claim_quote,
      location,
      verdict,
      suggested_check,
      ...(turnRef ? { evidence_turn_id: turnRef } : {}),
    };
  }

  if (kind === "decision_candidates") {
    const call = str(row["call"], 400);
    const origin = str(row["origin"], 400);
    const what_it_decided = str(row["what_it_decided"], 600);
    if (!call || !origin || !what_it_decided) return null;
    const turnRef = normalizeTurnRef(str(row["evidence_turn_id"], 120));
    const deliverable_location = str(row["deliverable_location"], 200);
    // Same rule as the open checks branch: on a thread run the anchor must name
    // a model turn in this conversation, or the item is dropped, never repaired.
    if (opts.requireEvidenceTurn) {
      if (!turnRef) return null;
      if (opts.allowedTurnRefs && !opts.allowedTurnRefs.includes(turnRef)) return null;
    }
    if (!turnRef && !deliverable_location) return null;
    // The one new field this pass. An unknown value is not kept; the item still
    // stands, and reads as untraceable.
    const origin_class = oneOf(row["origin_class"], DECISION_ORIGIN_CLASSES);
    return {
      call,
      origin,
      what_it_decided,
      ...(turnRef ? { evidence_turn_id: turnRef } : {}),
      ...(deliverable_location ? { deliverable_location } : {}),
      ...(origin_class ? { origin_class } : {}),
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

/**
 * Where the sentinel fence begins in a piece of text, or -1. A bare sentinel
 * token with no fence before it names nothing and is skipped.
 */
export function sentinelFenceStart(text: string): number {
  let from = 0;
  for (;;) {
    const marker = text.indexOf(HANDOFF_SENTINEL, from);
    if (marker === -1) return -1;
    const fence = text.lastIndexOf("```", marker);
    if (fence !== -1) return fence;
    from = marker + HANDOFF_SENTINEL.length;
  }
}

/** Where the LAST sentinel fence begins, or -1. The tail candidate. */
function lastSentinelFenceStart(text: string): number {
  let from = text.length;
  for (;;) {
    const marker = text.lastIndexOf(HANDOFF_SENTINEL, from);
    if (marker === -1) return -1;
    const fence = text.lastIndexOf("```", marker);
    if (fence !== -1) return fence;
    from = marker - 1;
  }
}

/**
 * Remove every sentinel-carrying fence from prose, and any bare sentinel
 * token. A sentinel fence is NEVER legitimate reader-facing content: an
 * answer's own quoted code has no sentinel, so a sentinel fence left in
 * prose is the model misplacing plumbing. Extras are never parsed as
 * handoffs; the tail block stays the single source of items.
 */
function scrubSentinelFences(text: string): string {
  let out = text;
  let removed = false;
  for (let guard = 0; guard < 50; guard += 1) {
    const marker = out.indexOf(HANDOFF_SENTINEL);
    if (marker === -1) break;
    removed = true;
    const open = out.lastIndexOf("```", marker);
    if (open === -1) {
      // A bare sentinel token with no fence around it: drop the token itself.
      out = out.slice(0, marker) + out.slice(marker + HANDOFF_SENTINEL.length);
      continue;
    }
    const close = out.indexOf("```", marker + HANDOFF_SENTINEL.length);
    const end = close === -1 ? out.length : close + 3;
    out = out.slice(0, open) + out.slice(end);
  }
  // Collapse the whitespace the removed blocks leave behind.
  const collapsed = removed ? out.replace(/\n{3,}/g, "\n\n") : out;
  return collapsed.trimEnd();
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
 *
 * The model sometimes repeats the sentinel fence mid-answer. The LAST sentinel
 * fence is the tail candidate and the single source of items; every other
 * sentinel fence (or bare sentinel token) is scrubbed from the prose, so the
 * sentinel never reaches a reader whatever the model did.
 */
export function stripHandoffTail(
  text: string,
  kind: HandoffKind | null,
  opts: HandoffAnchorOptions = {},
): StripResult {
  const start = sentinelFenceStart(text);
  if (start === -1) {
    if (!text.includes(HANDOFF_SENTINEL)) return { prose: text, block: null, parse: "none" };
    // Bare sentinel token(s) and no fenced sentinel at all: still never reader content.
    return { prose: scrubSentinelFences(text), block: null, parse: "malformed" };
  }

  const tailStart = lastSentinelFenceStart(text);
  const fenced = text.slice(tailStart);
  const body = fenced.replace(/^```[a-zA-Z]*\s*/, "").replace(/```\s*$/, "");
  const jsonStart = body.indexOf("{");
  if (!kind || jsonStart === -1) return { prose: scrubSentinelFences(text), block: null, parse: "malformed" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.slice(jsonStart));
  } catch {
    return { prose: scrubSentinelFences(text), block: null, parse: "malformed" };
  }
  const root = parsed as Record<string, unknown> | null;
  if (!root || typeof root !== "object") return { prose: scrubSentinelFences(text), block: null, parse: "malformed" };
  const rawItems = root[kind] ?? root["items"];
  if (!Array.isArray(rawItems)) return { prose: scrubSentinelFences(text), block: null, parse: "malformed" };

  const items = rawItems
    .slice(0, MAX_HANDOFF_ITEMS)
    .map((item) => validateItem(kind, item, opts))
    .filter((item): item is HandoffFields => item !== null);

  if (items.length === 0) return { prose: scrubSentinelFences(text), block: null, parse: "malformed" };
  return {
    prose: scrubSentinelFences(text.slice(0, tailStart)),
    block: { v: 1, kind, items },
    parse: "ok",
  };
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
    open_checks: `{"open_checks":[{"claim_quote":"<verbatim span from the work>","location":"<where it sits>","verdict":"nothing_visible|contradicted","suggested_check":"<the check a reviewer could run>","evidence_turn_id":"<turn number the claim was produced in, or omit>"}]}`,
    decision_candidates: `{"decision_candidates":[{"call":"<the call that was made>","origin":"<where it came from>","what_it_decided":"<what it settled>","origin_class":"<one of brief, you, model_accepted, model_changed, source, untraceable>","evidence_turn_id":"<turn number or id, or omit>","deliverable_location":"<where in the work, or omit>"}]}`,
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

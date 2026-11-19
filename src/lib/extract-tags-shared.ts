/**
 * Firm brain tags for real firms (Firm Brain Build Spec, step 5). The index card call that already runs for every
 * captured item also returns how the work was done (method), who a call was with (call_role), where a deliverable got
 * to (stage) and, on the one item that defines the engagement, the kind of problem (situation). Everything here is
 * pure: what to ask, what survives of the model's reply, which item carries the situation, how a board lead's
 * correction is checked and stored. Code keeps only values from the fixed lists in engagement-tags.ts.
 */

import {
  METHOD_LABELS,
  METHODS,
  methodsOf,
  ROLE_LABELS,
  ROLES,
  roleOf,
  SITUATION_LABELS,
  SITUATIONS,
  situationOf,
  STAGES,
  stageOf,
  TAG_CORRECTION_KEY,
  tagCorrectionOf,
  type Method,
  type Role,
  type Situation,
  type Stage,
} from "./engagement-tags";
import { isDeliverableType } from "./lineage-shared";

/** Which tags one item is asked for. Method on everything; the rest only where they mean something. */
export type TagAsk = { method: boolean; callRole: boolean; stage: boolean; situation: boolean };

export const NO_TAGS: TagAsk = { method: false, callRole: false, stage: false, situation: false };

export function tagAskFor(item: { type: string }, carrier: boolean): TagAsk {
  return { method: true, callRole: item.type === "call", stage: isDeliverableType(item.type), situation: carrier };
}

/**
 * True for an item the demo seed wrote. Its tags are hand labels (demo-firm/plan.ts), and the firm map in a buyer
 * demo is built from them, so the extractor never asks for or writes tags on a seeded item. Work captured into the
 * demo firm afterwards is tagged like any other.
 */
export function isHandLabelled(sourceMeta: unknown): boolean {
  return Boolean(sourceMeta) && typeof sourceMeta === "object" && (sourceMeta as Record<string, unknown>)["demo_firm"] === true;
}

/** The JSON keys the model is asked to add, in the order the prompt lists them. */
export function tagKeysAsked(ask: TagAsk): string[] {
  return [ask.method ? "method" : null, ask.callRole ? "call_role" : null, ask.stage ? "stage" : null, ask.situation ? "situation" : null].filter(
    (key): key is string => key !== null,
  );
}

/**
 * The lines added to the card prompt, one per tag asked. Kept short on purpose: this text is paid for on every
 * capture, and the role and situation lists are only sent for the items that need them.
 */
export function tagPromptLines(ask: TagAsk): string[] {
  const lines: string[] = [];
  if (ask.method) {
    // Worded from the first live tag check (18 Nov 2026, 21 of 40): the model added synthesis to plain research notes
    // and read interviews with the client's market as stakeholder interviews. The second check (32 of 40) still missed
    // five market interviews because nothing said who the client was, so CLIENT here points at clientPromptLine below.
    // Every word here is paid for per capture.
    lines.push(`- method: the one main way this item's own work was done, as a JSON array of ids: ${METHODS.join(", ")}. stakeholder_interviews: people who work at CLIENT; customer_research: its customers, buyers or market. synthesis: only a storyline across other work, never a note's own findings. [] for a SOW, proposal or admin note.`);
  }
  if (ask.callRole) {
    lines.push(`- call_role: the job of the person outside the team on this call, one id: ${ROLES.join(", ")}. Never a person's name. null for an internal call.`);
  }
  if (ask.stage) lines.push(`- stage: "draft" if the item calls itself a draft, v0, v1 or scratch, else "reviewed".`);
  if (ask.situation) lines.push(`- situation: the kind of problem the client brought, as one id: ${SITUATIONS.join(", ")}.`);
  return lines;
}

/** A client name longer than this is cut: the line is paid for on every capture and a name is all it is for. */
export const CLIENT_NAME_CHARS = 80;

/**
 * The one line that tells the model who the client is, so it can tell the client's own staff from the client's
 * market (Liam, 19 Nov 2026: send the client name, not the whole brief). The name is typed by a person, so it is
 * flattened to one line of plain characters and cut short: it can never start a new line of the prompt or close the
 * content. Null when there is no usable name, and then no line is sent.
 */
export function clientPromptLine(name: string | null | undefined): string | null {
  if (typeof name !== "string") return null;
  const flat = name
    .replace(/[\u0000-\u001f\u007f<>`{}\[\]]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, CLIENT_NAME_CHARS)
    .trim();
  return /[\p{L}\p{N}]/u.test(flat) ? `CLIENT: ${flat}` : null;
}

/** What the extractor knows about one item when it checks the model's tags. */
export type TagContext = {
  type: string;
  /** True when this item carries the engagement's situation (situationCarrierId). */
  carrier: boolean;
  /** True when a person marked this deliverable as shown to the client. The stage is read from that, never from a model. */
  shown: boolean;
  /** Every person and client name known for the item's board and workspace. */
  names: string[];
};

/** The tags as stored in work_items.meta, under the same keys the demo seed writes. */
export type ExtractedTags = { method?: Method[]; call_role?: Role; stage?: Stage; situation?: Situation };

/** Longer than any id or label in the lists: a longer string is junk, not a value outside the list. */
export const MAX_TAG_CHARS = 60;
/** How many method entries are read from a reply before the rest is ignored. */
const MAX_METHOD_ENTRIES = 20;

const words = (text: string): string[] =>
  text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

function byIdOrLabel<T extends string>(list: readonly T[], labels: Record<T, string>): Map<string, T> {
  const map = new Map<string, T>();
  for (const id of list) {
    map.set(words(id).join("_"), id);
    map.set(words(labels[id]).join("_"), id);
  }
  return map;
}

const METHOD_LOOKUP = byIdOrLabel(METHODS, METHOD_LABELS);
const ROLE_LOOKUP = byIdOrLabel(ROLES, ROLE_LABELS);
const SITUATION_LOOKUP = byIdOrLabel(SITUATIONS, SITUATION_LABELS);

/**
 * One value against one list: the id when it is the id or its label, "other" for any other short string, and null
 * (dropped) for anything that is not a string, is empty or is overlong.
 */
function fromList<T extends string>(lookup: Map<string, T>, value: unknown): T | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_TAG_CHARS) return null;
  const key = words(trimmed).join("_");
  if (!key) return null;
  return lookup.get(key) ?? ("other" as T);
}

/** Words the role list itself uses, so a client called "Customer First" never blocks the role "customer". */
const ROLE_WORDS = new Set([...ROLES.flatMap((role) => words(role)), ...Object.values(ROLE_LABELS).flatMap((label) => words(label))]);
/** Words many organisations share. On their own they do not name anyone. */
const GENERIC_NAME_WORDS = new Set(
  "the and of for inc llc ltd plc co company corp corporation group holdings partners capital fund health healthcare hospital hospitals system systems services software bank insurance mutual media college university school schools institute council network alliance collaborative foundation association regional national community learning arts museum".split(
    " ",
  ),
);

/**
 * True when a role holds a known name: the whole name, or one distinctive word of it (a first or last name, or the
 * part of a client's name that is not a generic word). Whole words only, so "Park" does not match "parks".
 */
export function nameInRole(role: string, names: readonly string[]): boolean {
  const roleWords = words(role);
  if (!roleWords.length) return false;
  const spaced = ` ${roleWords.join(" ")} `;
  for (const name of names) {
    const nameWords = words(name);
    if (!nameWords.length) continue;
    if (spaced.includes(` ${nameWords.join(" ")} `)) return true;
    for (const word of nameWords) {
      if (word.length < 3 || ROLE_WORDS.has(word) || GENERIC_NAME_WORDS.has(word)) continue;
      if (roleWords.includes(word)) return true;
    }
  }
  return false;
}

/**
 * What survives of the model's tags. A value outside a list becomes "other"; wrong types, empty and overlong strings
 * are dropped; a role holding a known name is dropped; a tag the item was not asked for is dropped. The stage is
 * "shown_to_client" only when a person marked it so: a model cannot say what a client saw.
 */
export function validateExtractedTags(reply: unknown, context: TagContext): ExtractedTags {
  const ask = tagAskFor(context, context.carrier);
  const parsed = reply && typeof reply === "object" && !Array.isArray(reply) ? (reply as Record<string, unknown>) : {};
  const tags: ExtractedTags = {};

  const rawMethods = Array.isArray(parsed["method"]) ? parsed["method"].slice(0, MAX_METHOD_ENTRIES) : [parsed["method"]];
  const found = new Set(rawMethods.map((value) => fromList(METHOD_LOOKUP, value)).filter((value): value is Method => value !== null));
  const methods = METHODS.filter((method) => found.has(method));
  if (methods.length) tags.method = methods;

  if (ask.callRole && typeof parsed["call_role"] === "string" && !nameInRole(parsed["call_role"], context.names)) {
    const role = fromList(ROLE_LOOKUP, parsed["call_role"]);
    if (role) tags.call_role = role;
  }

  if (ask.stage) {
    const stage = typeof parsed["stage"] === "string" ? parsed["stage"].trim().toLowerCase() : "";
    if (context.shown) tags.stage = "shown_to_client";
    else if (stage === "draft" || stage === "reviewed") tags.stage = stage;
  }

  if (ask.situation) {
    const situation = fromList(SITUATION_LOOKUP, parsed["situation"]);
    if (situation) tags.situation = situation;
  }
  return tags;
}

/** The reply's JSON object, or null when it is not one. Never throws. */
export function parseTagReply(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const KEY_OF: Record<keyof TagAsk, keyof ExtractedTags> = { method: "method", callRole: "call_role", stage: "stage", situation: "situation" };

/**
 * The item's meta after an extract: each tag that was asked for is replaced by what survived, or removed when nothing
 * did. Tags that were not asked for, the lead's correction and every other key are left exactly as they were.
 */
export function mergeExtractedTags(meta: unknown, tags: ExtractedTags, ask: TagAsk): Record<string, unknown> {
  const next: Record<string, unknown> = meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {};
  for (const asked of Object.keys(KEY_OF) as (keyof TagAsk)[]) {
    if (!ask[asked]) continue;
    const key = KEY_OF[asked];
    const value = tags[key];
    if (value === undefined) delete next[key];
    else next[key] = value;
  }
  return next;
}

/** True when two metas hold the same stored tags, so an extract that changed nothing writes nothing. */
export function sameStoredTags(a: unknown, b: unknown): boolean {
  const pick = (meta: unknown) => {
    const record = meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
    return JSON.stringify(Object.values(KEY_OF).map((key) => record[key] ?? null));
  };
  return pick(a) === pick(b);
}

/** One item on a board, as the carrier rule reads it. */
export type CarrierCandidate = { id: string; type: string; title: string; visibility: string; meta: unknown; date: string | null };

const SOW_TITLE = /\b(sow|statement of work|scope of work|engagement letter)\b/i;
const BRIEF_TITLE = /\b(brief|rfp|request for proposal)\b/i;

/**
 * How strongly an item defines its engagement, lower first, or null when it does not: 0 a situation the lead set by
 * hand, 1 a SOW (it has fee terms, or its title says so), 2 a brief (marked as one, or its title says so), 3 a
 * proposal. Private items never carry it: the firm could not read it there.
 */
export function situationRank(item: Pick<CarrierCandidate, "type" | "title" | "visibility" | "meta">): number | null {
  if (item.visibility !== "mapped") return null;
  const meta = item.meta && typeof item.meta === "object" && !Array.isArray(item.meta) ? (item.meta as Record<string, unknown>) : {};
  const correction = tagCorrectionOf(meta);
  if (correction && typeof correction["situation"] === "string" && correction["situation"]) return 0;
  if (!isDeliverableType(item.type)) return null;
  if ((meta["sow_facts"] && typeof meta["sow_facts"] === "object") || SOW_TITLE.test(item.title)) return 1;
  if (meta["role"] === "brief" || BRIEF_TITLE.test(item.title)) return 2;
  if (meta["deliverable_kind"] === "proposal") return 3;
  return null;
}

/**
 * The one item on a board that holds the engagement's situation (the demo seed's situationCarrier, for real boards).
 * Best rank wins, then the earliest date, then the id, so the choice never changes between runs.
 */
export function situationCarrierId(items: readonly CarrierCandidate[]): string | null {
  const ranked = items
    .map((item) => ({ item, rank: situationRank(item) }))
    .filter((entry): entry is { item: CarrierCandidate; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || (a.item.date ?? "9999").localeCompare(b.item.date ?? "9999") || a.item.id.localeCompare(b.item.id));
  return ranked[0]?.item.id ?? null;
}

/**
 * Whether a lead may set the situation on this item: it is the board's carrier, or the board has none yet and this is
 * a deliverable the firm can read, which then becomes the carrier.
 */
export function canHoldSituation(item: CarrierCandidate, boardItems: readonly CarrierCandidate[]): boolean {
  const carrier = situationCarrierId(boardItems);
  if (carrier) return carrier === item.id;
  return item.visibility === "mapped" && isDeliverableType(item.type);
}

/** The board's lead (its owner) and workspace admins correct tags. Nobody else, whatever the menu shows. */
export function canCorrectTags(viewer: { role: string | null | undefined; isBoardLead: boolean }): boolean {
  return viewer.role === "admin" || viewer.isBoardLead;
}

/**
 * Written with the name Lasso, like all app copy; the dialog passes helper and reset through useBrandCopy so the name
 * follows the look (Liam, 19 Nov 2026). Never type the other name here.
 */
export const ITEM_TAGS_COPY = {
  menu: "Tags…",
  title: "Tags",
  helper: "How the firm finds this work again. Lasso reads these when the item is captured; what you set here stays, even when the item is read again.",
  methodLabel: "How the work was done",
  roleLabel: "Who the call was with",
  stageLabel: "Stage",
  situationLabel: "What the engagement is about",
  none: "Not set",
  correctedNote: "Set by the board lead.",
  save: "Save tags",
  reset: "Use what Lasso read",
  cancel: "Cancel",
  loading: "Loading…",
  loadFailed: "Could not load the tags. Close and try again.",
  failed: "Could not save the tags. Only the board lead and admins can change them.",
  badMethod: "Pick the methods from the list.",
  badRole: "Pick a role from the list.",
  badStage: "Pick a stage from the list.",
  badSituation: "Pick a situation from the list.",
  notOnBoard: "Put this item on a board first.",
} as const;

/** Which fields the dialog shows for one item. Method always. */
export type TagFields = { callRole: boolean; stage: boolean; situation: boolean };

export function tagFieldsFor(item: { type: string }, holdsSituation: boolean): TagFields {
  return { callRole: item.type === "call", stage: isDeliverableType(item.type), situation: holdsSituation };
}

/** The tags as the firm reads them now, for the dialog. */
export type ItemTagsView = {
  method: Method[];
  call_role: Role | null;
  stage: Stage | null;
  situation: Situation | null;
  /** True when a lead has corrected this item. */
  corrected: boolean;
  fields: TagFields;
};

export function itemTagsView(item: { type: string; meta: unknown }, holdsSituation: boolean): ItemTagsView {
  const fields = tagFieldsFor(item, holdsSituation);
  return {
    method: methodsOf(item.meta),
    call_role: fields.callRole ? roleOf(item.meta) : null,
    stage: fields.stage ? stageOf(item.meta) : null,
    situation: fields.situation ? situationOf(item.meta) : null,
    corrected: tagCorrectionOf(item.meta) !== null,
    fields,
  };
}

export type TagCorrectionInput = { method?: unknown; call_role?: unknown; stage?: unknown; situation?: unknown };

export type TagCorrection = {
  method: Method[];
  call_role?: Role | null;
  stage?: Stage | null;
  situation?: Situation | null;
  by: string;
  at: string;
};

/** Empty means "none"; a string from the list is itself; any other string is "other"; anything else is a problem. */
function pick<T extends string>(lookup: Map<string, T>, value: unknown): { ok: true; value: T | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value !== "string" || value.trim().length > MAX_TAG_CHARS) return { ok: false };
  return { ok: true, value: fromList(lookup, value) };
}

/**
 * A lead's correction, checked against the lists: only the fields this item shows are kept, a value outside a list is
 * stored as "other" and never as typed, and a wrong type is refused with a line to show.
 */
export function buildTagCorrection(
  input: TagCorrectionInput,
  fields: TagFields,
  by: string,
  now: Date = new Date(),
): { ok: true; correction: TagCorrection } | { ok: false; problem: string } {
  if (!Array.isArray(input?.method) || input.method.length > MAX_METHOD_ENTRIES || input.method.some((value) => typeof value !== "string" || value.trim().length > MAX_TAG_CHARS)) {
    return { ok: false, problem: ITEM_TAGS_COPY.badMethod };
  }
  const found = new Set(input.method.map((value) => fromList(METHOD_LOOKUP, value)).filter((value): value is Method => value !== null));
  const correction: TagCorrection = { method: METHODS.filter((method) => found.has(method)), by, at: now.toISOString() };

  if (fields.callRole) {
    const role = pick(ROLE_LOOKUP, input.call_role);
    if (!role.ok) return { ok: false, problem: ITEM_TAGS_COPY.badRole };
    correction.call_role = role.value;
  }
  if (fields.stage) {
    const stage = input.stage === null || input.stage === undefined || input.stage === "" ? null : input.stage;
    if (stage !== null && !(typeof stage === "string" && (STAGES as readonly string[]).includes(stage))) return { ok: false, problem: ITEM_TAGS_COPY.badStage };
    correction.stage = stage as Stage | null;
  }
  if (fields.situation) {
    const situation = pick(SITUATION_LOOKUP, input.situation);
    if (!situation.ok) return { ok: false, problem: ITEM_TAGS_COPY.badSituation };
    correction.situation = situation.value;
  }
  return { ok: true, correction };
}

/** The item's meta with the lead's correction set, or removed. Every other key, the model's tags included, is kept. */
export function withTagCorrection(meta: unknown, correction: TagCorrection | null): Record<string, unknown> {
  const next: Record<string, unknown> = meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {};
  if (correction) next[TAG_CORRECTION_KEY] = correction;
  else delete next[TAG_CORRECTION_KEY];
  return next;
}

/** A rough token count for a prompt or reply: about four characters a token in English and JSON. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * What the tags add to one extract call, as a rough count: the prompt lines going in, and a typical reply coming out
 * (one method, plus a role, a stage or a situation where asked).
 */
export function tagTokenEstimate(ask: TagAsk): { tokensIn: number; tokensOut: number } {
  const keys = tagKeysAsked(ask);
  if (!keys.length) return { tokensIn: 0, tokensOut: 0 };
  const promptIn = estimateTokens([`, ${keys.join(", ")}`, ...tagPromptLines(ask)].join("\n"));
  const sample: Record<string, unknown> = {};
  if (ask.method) sample["method"] = ["stakeholder_interviews"];
  if (ask.callRole) sample["call_role"] = "chief_financial_officer";
  if (ask.stage) sample["stage"] = "reviewed";
  if (ask.situation) sample["situation"] = "operating_model";
  return { tokensIn: promptIn, tokensOut: estimateTokens(`,${JSON.stringify(sample).slice(1, -1)}`) };
}

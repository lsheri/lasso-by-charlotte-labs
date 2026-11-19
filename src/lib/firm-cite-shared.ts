/**
 * "Cite this" (Firm Brain Build Spec step 7): one sourced line from the firm's past work, added to an item the person
 * owns. Pure parts, so the rules are tested without a database.
 *
 * - A cited line lives in the owner's own `work_items.meta.citations`, with no schema change. It holds the quoted
 *   words and a reference to the source as ids (item and board), never a pasted link that could outlive sharing.
 * - The words stored are the source's own, found again on the server word for word in what this person may read. The
 *   text the browser sent is never stored.
 * - A cited line is shown only to the item's owner, and only while the firm reader still serves its source to them.
 *   When the source's board stops being shared, the words and the link both go: the line reads "A cited source is no
 *   longer shared".
 * - No cited line holds a money figure or an opinion about a person, for anyone.
 */

import { holdsOpinion } from "./firm-ask-shared";
import type { FirmBoard, FirmCorpus, FirmItem } from "./firm-corpus-shared";
import { mentionsMoney, walkGrade } from "./firm-walkthrough-shared";

export const CITE_MAX_PER_ITEM = 20;
export const CITE_QUOTE_MIN_CHARS = 12;
export const CITE_QUOTE_MAX_CHARS = 400;
/** How many of a person's own recent items the picker lists. */
export const CITE_TARGETS_MAX = 25;

export const CITE_COPY = {
  action: "Cite this",
  title: "Cite this in your work",
  hint: "Adds this line, with a link to where it came from, to an item you own. Only you see it there.",
  targetLabel: "Add it to",
  pickTarget: "Pick one of your items",
  noTargets: "You have no items of your own to add this to yet.",
  targetsError: "Your items could not be loaded. Try again.",
  submit: "Add the line",
  cancel: "Cancel",
  close: "Done",
  done: "Added. Open the item from All work to see it.",
  refused: "That item is not yours to add to, so nothing was added.",
  gone: "That source is no longer shared with the firm, so it cannot be cited.",
  notFound: "That line could not be found in its source, so nothing was added.",
  full: `This item already holds ${CITE_MAX_PER_ITEM} cited lines. Remove one first.`,
  error: "That did not work. Nothing was added. Try again.",
  listTitle: "Cited from the firm",
  unshared: "A cited source is no longer shared.",
  open: "Open the source",
  remove: "Remove",
  removeLabel: "Remove this cited line",
  removeError: "The line could not be removed. Try again.",
  loadError: "The cited lines could not be loaded.",
  ownerOnly: "Only you see these lines.",
} as const;

/** One cited line as stored in the owner's item meta. */
export type StoredCitation = {
  id: string;
  quote: string;
  source_item_id: string;
  source_board_id: string;
  cited_at: string;
};

const collapse = (text: string) => text.replace(/\s+/g, " ").trim();

function metaOf(meta: unknown): Record<string, unknown> {
  return meta && typeof meta === "object" && !Array.isArray(meta) ? { ...(meta as Record<string, unknown>) } : {};
}

/** The well-formed cited lines in an item's meta. Anything malformed is ignored, never shown. */
export function citationsOf(meta: unknown): StoredCitation[] {
  const raw = metaOf(meta)["citations"];
  if (!Array.isArray(raw)) return [];
  const out: StoredCitation[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const { id, quote, source_item_id, source_board_id, cited_at } = row;
    if (
      typeof id !== "string" ||
      !id ||
      typeof quote !== "string" ||
      typeof source_item_id !== "string" ||
      !source_item_id ||
      typeof source_board_id !== "string"
    )
      continue;
    out.push({ id, quote, source_item_id, source_board_id, cited_at: typeof cited_at === "string" ? cited_at : "" });
  }
  return out;
}

/** The item's meta with one more cited line. Every other key is kept as it was. */
export function withCitation(meta: unknown, citation: StoredCitation): Record<string, unknown> {
  return { ...metaOf(meta), citations: [...citationsOf(meta), citation] };
}

/** The item's meta without one cited line. The key goes when the last line does. */
export function withoutCitation(meta: unknown, citationId: string): Record<string, unknown> {
  const next = metaOf(meta);
  const kept = citationsOf(meta).filter((citation) => citation.id !== citationId);
  if (kept.length) next["citations"] = kept;
  else delete next["citations"];
  return next;
}

/**
 * The source's own words for a quote: the stretch of the source that matches it, allowing only for line breaks, runs
 * of spaces and letter case (Ask the firm checks its quotes without case). Null when the quote is not there. What is
 * returned is cut from the source, so it can be stored without trusting the text that was sent.
 */
export function sourceWords(source: string, quote: string): string | null {
  const text = collapse(source);
  const needle = collapse(quote);
  if (needle.length < CITE_QUOTE_MIN_CHARS || needle.length > CITE_QUOTE_MAX_CHARS) return null;
  const exact = text.indexOf(needle);
  if (exact >= 0) return text.slice(exact, exact + needle.length);
  const lower = text.toLowerCase();
  // Lower-casing can change a string's length in a few scripts; then only an exact match counts.
  if (lower.length !== text.length) return null;
  const at = lower.indexOf(needle.toLowerCase());
  return at < 0 ? null : text.slice(at, at + needle.length);
}

/** May these words be cited at all: no money and no opinion about a person, whoever is asking. */
export function citable(words: string): boolean {
  return !mentionsMoney(words) && !holdsOpinion(words);
}

/** A source's index card: what everyone the corpus serves may read of it. */
export function cardOf(item: Pick<FirmItem, "summary" | "decisions">): string {
  return [item.summary, item.decisions].filter(Boolean).join("\n");
}

/** The source of a cited line as the firm reader serves it now, or null when it is gone. */
export function liveSource(
  corpus: FirmCorpus,
  sourceItemId: string,
): { item: FirmItem; board: FirmBoard } | null {
  const item = corpus.items.find((entry) => entry.id === sourceItemId);
  const board = item && corpus.boards.find((entry) => entry.id === item.boardId);
  return item && board ? { item, board } : null;
}

/** One cited line as the owner's reader shows it. A gone line carries no words and no source. */
export type CitedLine =
  | {
      id: string;
      state: "live";
      quote: string;
      sourceItemId: string;
      /** The engagement's name, never the source's own title. */
      engagement: string;
      date: string;
      type: string;
    }
  | { id: string; state: "gone" };

/**
 * The cited lines of one item, checked against the corpus as it is now. A line is live only while its source is still
 * served to this person and, for a source they may read as its summary only (a call on a board they are not on, or a
 * summary-only item), while its words are in that summary. Otherwise it is gone, and its words do not leave the server.
 */
export function resolveCitations(corpus: FirmCorpus, stored: readonly StoredCitation[]): CitedLine[] {
  return stored.map((citation): CitedLine => {
    const source = liveSource(corpus, citation.source_item_id);
    if (!source) return { id: citation.id, state: "gone" };
    const readable =
      walkGrade(source.item, source.board) === "full" || sourceWords(cardOf(source.item), citation.quote) !== null;
    if (!readable || !citable(citation.quote)) return { id: citation.id, state: "gone" };
    return {
      id: citation.id,
      state: "live",
      quote: citation.quote,
      sourceItemId: source.item.id,
      engagement: source.board.client?.trim() || source.board.title,
      date: source.item.date ?? source.board.startedOn,
      type: source.item.type,
    };
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuid(value: unknown, message: string): string {
  const id = typeof value === "string" ? value.trim() : "";
  if (!UUID.test(id)) throw new Error(message);
  return id;
}

const rawOf = (input: unknown) =>
  (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
const profileIdOf = (raw: Record<string, unknown>): string | null => {
  const value = raw["profile_id"];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export type CiteLineInput = {
  target_item_id: string;
  source_item_id: string;
  quote: string;
  profile_id: string | null;
};

/** What "Cite this" accepts: two item ids and a line of a sane length. Anything else is refused before any read. */
export function validateCiteInput(input: unknown): CiteLineInput {
  const raw = rawOf(input);
  const quote = typeof raw["quote"] === "string" ? collapse(raw["quote"]) : "";
  if (quote.length < CITE_QUOTE_MIN_CHARS) throw new Error("Pick a line to cite first.");
  if (quote.length > CITE_QUOTE_MAX_CHARS) throw new Error("That line is too long to cite.");
  return {
    target_item_id: uuid(raw["target_item_id"], "Pick one of your items first."),
    source_item_id: uuid(raw["source_item_id"], "Unknown source."),
    quote,
    profile_id: profileIdOf(raw),
  };
}

export type CiteItemInput = { item_id: string; profile_id: string | null };

export function validateCiteItemInput(input: unknown): CiteItemInput {
  const raw = rawOf(input);
  return { item_id: uuid(raw["item_id"], "Unknown item."), profile_id: profileIdOf(raw) };
}

export type CiteRemoveInput = { item_id: string; citation_id: string; profile_id: string | null };

export function validateCiteRemoveInput(input: unknown): CiteRemoveInput {
  const raw = rawOf(input);
  return {
    item_id: uuid(raw["item_id"], "Unknown item."),
    citation_id: uuid(raw["citation_id"], "Unknown line."),
    profile_id: profileIdOf(raw),
  };
}

export type WalkOfferInput = {
  item_id: string;
  state: "opened" | "dismissed" | "reset";
  profile_id: string | null;
};

export function validateWalkOfferInput(input: unknown): WalkOfferInput {
  const raw = rawOf(input);
  const state = raw["state"];
  if (state !== "opened" && state !== "dismissed" && state !== "reset")
    throw new Error("Unknown choice.");
  return { item_id: uuid(raw["item_id"], "Unknown item."), state, profile_id: profileIdOf(raw) };
}

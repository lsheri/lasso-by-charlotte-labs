/**
 * "Cite this" and the once-only offer, server side (Firm Brain Build Spec step 7). Every write lands on an item the
 * caller owns, through the caller's own database client: the reads and writes below are passed in already scoped to
 * the caller's profile, and a write that changes no row is a refusal, never a silent success.
 *
 * The corpus, the text loader and the item reads are passed in, so every rule is tested without a database.
 */

import { maskFees } from "./firm-ask-shared";
import { withoutFees, type FirmCorpus } from "./firm-corpus-shared";
import {
  cardOf,
  citable,
  CITE_MAX_PER_ITEM,
  citationEntriesOf,
  citationsOf,
  isTombstone,
  withCitationsDeleted,
  liveSource,
  resolveCitations,
  sourceWords,
  withCitation,
  withoutCitation,
  type CitedLine,
  type StoredCitation,
} from "./firm-cite-shared";
import { walkGrade } from "./firm-walkthrough-shared";
import { withWalkOffer, type WalkOfferState } from "./walk-offer-shared";

export type OwnItemDeps = {
  /** The caller's own item, read as the caller: null when it is not theirs, not in their workspace or gone. */
  readOwn: (itemId: string) => Promise<{ meta: unknown } | null>;
  /** Writes the caller's own item's meta as the caller. Returns how many rows changed: 0 means refused. */
  writeOwn: (itemId: string, meta: Record<string, unknown>) => Promise<number>;
};

export type CiteDeps = OwnItemDeps & {
  /** What the firm reader serves this caller, read for this request. */
  corpus: FirmCorpus;
  /** Admins and leads only: everyone else is checked against the text with its fees taken out. */
  canSeeFees: boolean;
  /** The full text of an item the corpus lets the caller quote, or null. */
  loadText: (itemId: string) => Promise<string | null>;
  now: () => string;
  newId: () => string;
};

export type CiteInput = { targetItemId: string; sourceItemId: string; quote: string };

const refused = () => new Response("Forbidden", { status: 403 });
const gone = () => new Response("Not found", { status: 404 });
/** The line is not in what this person may read of the source, or may not be cited. Nothing more is said. */
const unverified = () => new Response("Unprocessable", { status: 422 });
const full = () => new Response("Conflict", { status: 409 });

/**
 * Adds one cited line to an item the caller owns. In order: the source must be served to the caller by the firm
 * reader now; the words must be found in what the caller may read of it (its text when they may read it in full, with
 * fees withheld unless they have fee access, and always its stored summary); the words kept are the source's own; and
 * the target must be the caller's. A line already cited from the same source is returned, not added twice.
 */
export async function citeLine(deps: CiteDeps, input: CiteInput): Promise<{ citation: StoredCitation; added: boolean }> {
  const source = liveSource(deps.corpus, input.sourceItemId);
  if (!source) throw gone();

  let words = sourceWords(cardOf(source.item), input.quote);
  if (!words && walkGrade(source.item, source.board) === "full") {
    const text = await deps.loadText(source.item.id);
    if (text) words = sourceWords(deps.canSeeFees ? text : maskFees(withoutFees(text)), input.quote);
  }
  if (!words || !citable(words)) throw unverified();

  const target = await deps.readOwn(input.targetItemId);
  if (!target) throw refused();
  const held = citationsOf(target.meta);
  const same = held.find((entry) => entry.source_item_id === source.item.id && entry.quote === words);
  if (same) return { citation: same, added: false };
  if (citationEntriesOf(target.meta).length >= CITE_MAX_PER_ITEM) throw full();

  const citation: StoredCitation = {
    id: deps.newId(),
    quote: words,
    source_item_id: source.item.id,
    source_board_id: source.board.id,
    cited_at: deps.now(),
  };
  const rows = await deps.writeOwn(input.targetItemId, withCitation(target.meta, citation));
  if (rows < 1) throw refused();
  return { citation, added: true };
}

/**
 * The cited lines of one item, for its owner only: anyone else gets none. Each is checked against the corpus as it is
 * for this request. A line whose source is no longer served to the owner comes back with no words and no link, and
 * in this same request its words and source ids are deleted from the item, leaving a tombstone (id, time, gone).
 *
 * The delete re-reads the item just before it writes and rebuilds only the `citations` key, so a key another writer
 * changed in between (tags, the offer mark, a line added meanwhile) is carried over as it now is. It goes through the
 * owner's own write gate. If it is refused or fails, the view returned is still the hidden one, never the words, and
 * the next read tries again. When nothing needs deleting, nothing is written.
 */
export async function readCitedLines(
  deps: Pick<CiteDeps, "corpus" | "readOwn" | "writeOwn">,
  itemId: string,
): Promise<CitedLine[]> {
  const target = await deps.readOwn(itemId);
  if (!target) return [];
  const entries = citationEntriesOf(target.meta);
  const view = resolveCitations(deps.corpus, entries);
  const goneIds = new Set(
    entries
      .filter((entry, index) => !isTombstone(entry) && view[index]?.state === "gone")
      .map((entry) => entry.id),
  );
  if (!goneIds.size) return view;
  try {
    const fresh = await deps.readOwn(itemId);
    if (fresh) await deps.writeOwn(itemId, withCitationsDeleted(fresh.meta, goneIds));
  } catch {
    // The view below already holds no words; the delete is tried again on the next read.
  }
  return view;
}

/** Removes one cited line from the caller's own item. Removing a line that is not there changes nothing. */
export async function removeCitedLine(deps: OwnItemDeps, itemId: string, citationId: string): Promise<{ removed: boolean }> {
  const target = await deps.readOwn(itemId);
  if (!target) throw refused();
  if (!citationEntriesOf(target.meta).some((entry) => entry.id === citationId)) return { removed: false };
  const rows = await deps.writeOwn(itemId, withoutCitation(target.meta, citationId));
  if (rows < 1) throw refused();
  return { removed: true };
}

/** Records on the caller's own item that the walk-through offer was opened or dismissed; null clears it. */
export async function saveWalkOffer(deps: OwnItemDeps, itemId: string, state: WalkOfferState | null): Promise<{ ok: true }> {
  const target = await deps.readOwn(itemId);
  if (!target) throw refused();
  const rows = await deps.writeOwn(itemId, withWalkOffer(target.meta, state));
  if (rows < 1) throw refused();
  return { ok: true };
}

/** The caller-scoped reads and writes: the caller's own client, their profile as owner, their workspace. */
export function ownItemDeps(
  supabase: import("@supabase/supabase-js").SupabaseClient<import("@/integrations/supabase/types").Database>,
  profile: { id: string; org_id: string },
): OwnItemDeps {
  return {
    readOwn: async (itemId) => {
      const { data, error } = await supabase
        .from("work_items")
        .select("id, meta")
        .eq("id", itemId)
        .eq("owner_id", profile.id)
        .eq("org_id", profile.org_id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { meta: data.meta } : null;
    },
    writeOwn: async (itemId, meta) => {
      const { data, error } = await supabase
        .from("work_items")
        .update({ meta: meta as never })
        .eq("id", itemId)
        .eq("owner_id", profile.id)
        .eq("org_id", profile.org_id)
        .select("id");
      if (error) throw new Error(error.message);
      return (data ?? []).length;
    },
  };
}

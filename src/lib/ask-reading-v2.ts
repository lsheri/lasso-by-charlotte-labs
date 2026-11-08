/**
 * V2-2 (ask-v2, 8 Nov decisions): the words Ask shows while it works and the
 * one-line receipt under an answer. Everything here is worked out on the
 * client from manifests the server already sent. No AI call, no new event.
 *
 * Rules (DECISIONS-nov08, rule 4):
 * - Never say "read" for something that was not read. A summary is not a read.
 * - Images count as read and are named "AI description of an image".
 * - Videos are never context, so they are never counted. A picked video is
 *   named "not read".
 * - Plain words: "used", "transcripts". Never cost.
 */

import type { ContextManifest, ManifestItem, ManifestKind } from "./context-manifest";

/** What a chip or a row shows. Adds display-only kinds the server never sends. */
export type ReadingKind = ManifestKind;

export type AskPhase = "gathering" | "reading" | "writing";

export const ASK_PHASE_LABEL: Record<AskPhase, string> = {
  gathering: "Gathering",
  reading: "Reading",
  writing: "Writing",
};

/** Gathering until the server says what it assembled, Writing from the first word. */
export function askPhase({
  manifest,
  streamed,
}: {
  manifest: ContextManifest | null | undefined;
  streamed: string | null | undefined;
}): AskPhase {
  if (streamed && streamed.length > 0) return "writing";
  if (manifest) return "reading";
  return "gathering";
}

/** The step the progress line is on: 1, 2 or 3 of 3. A stage, never a guess at time. */
export function askPhaseStep(phase: AskPhase): 1 | 2 | 3 {
  return phase === "gathering" ? 1 : phase === "reading" ? 2 : 3;
}

const NOUN: Record<ReadingKind, [string, string]> = {
  conversation: ["conversation", "conversations"],
  document: ["document", "documents"],
  deck: ["deck", "decks"],
  sheet: ["sheet", "sheets"],
  email: ["email", "emails"],
  note: ["note", "notes"],
  transcript: ["transcript", "transcripts"],
  brief: ["brief", "briefs"],
  item: ["piece of work", "pieces of work"],
  image: ["image", "images"],
  video: ["video", "videos"],
};

export function kindNoun(kind: ReadingKind, count: number): string {
  const [one, many] = NOUN[kind] ?? NOUN.item;
  return count === 1 ? one : many;
}

export const IMAGE_READ_DETAIL = "AI description of an image";
export const NOT_READ = "not read";

export function isImageItem(item: Pick<ManifestItem, "id">): boolean {
  return item.id?.startsWith("image:") ?? false;
}

/** The kind to draw: an image is an image, whatever the server tagged it. */
export function displayKind(item: Pick<ManifestItem, "id" | "kind">): ReadingKind {
  return isImageItem(item) ? "image" : item.kind;
}

/**
 * Was this item's own text in front of the model? A summary, an item with no
 * stored text, or text held out by the window is not a read.
 */
export function itemWasRead(item: ManifestItem): boolean {
  if (isImageItem(item)) return (item.chars_in ?? 0) > 0 || item.detail === IMAGE_READ_DETAIL;
  if (typeof item.chars_in === "number") return item.chars_in > 0;
  // Older manifests (catalogue path) carry no character counts, only the detail.
  return (
    item.detail === "read in full" ||
    /^turns?\b/i.test(item.detail) ||
    /\bwords?$/i.test(item.detail)
  );
}

/** "12 more pieces of work" stands for 12 rows in the catalogue path. */
function excludedWeight(title: string): number {
  const match = /^(\d+) more pieces of work$/.exec(title);
  return match ? Number(match[1]) : 1;
}

export type ReadTally = { read: number; total: number };

/** Read N of M across everything the person's choice covered. The brief and firm checks are not pieces of work. */
export function readTally(manifest: ContextManifest): ReadTally {
  const read = manifest.items.filter(itemWasRead).length;
  const excluded = manifest.excluded.reduce((sum, entry) => sum + excludedWeight(entry.title), 0);
  return { read, total: manifest.items.length + excluded };
}

export type KindChip = { kind: ReadingKind; count: number; read: number; fresh: boolean };

/** K4: one chip per kind, in the order the kinds first appear, with how many were read. */
export function kindChips(manifest: ContextManifest, freshIds?: ReadonlySet<string>): KindChip[] {
  const order: ReadingKind[] = [];
  const byKind = new Map<ReadingKind, KindChip>();
  for (const item of manifest.items) {
    const kind = displayKind(item);
    let chip = byKind.get(kind);
    if (!chip) {
      chip = { kind, count: 0, read: 0, fresh: false };
      byKind.set(kind, chip);
      order.push(kind);
    }
    chip.count += 1;
    if (itemWasRead(item)) chip.read += 1;
    if (freshIds && item.id && freshIds.has(item.id)) chip.fresh = true;
  }
  return order.map((kind) => byKind.get(kind)!);
}

/** "4 transcripts" when all were read, "3 of 4 transcripts" when one was not. */
export function chipLabel(chip: KindChip): string {
  const noun = kindNoun(chip.kind, chip.count);
  return chip.read === chip.count
    ? `${chip.count} ${noun}`
    : `${chip.read} of ${chip.count} ${noun}`;
}

/** The ids the server listed as read set or as items, for comparing turns. */
function manifestIds(manifest: ContextManifest): string[] {
  return manifest.items.map((item) => item.id).filter((id) => id.length > 0);
}

export type WhatsNew =
  | { kind: "first" }
  | { kind: "same"; count: number }
  | { kind: "changed"; freshIds: Set<string>; fresh: number };

/**
 * Only show what is new: the full sequence once per chat, then either "the same
 * set again" or which pieces joined. Worked out from the last answer's manifest.
 */
export function whatsNew(
  current: ContextManifest,
  previous: ContextManifest | null | undefined,
): WhatsNew {
  if (!previous) return { kind: "first" };
  const before = new Set(manifestIds(previous));
  const now = manifestIds(current);
  const freshIds = new Set(now.filter((id) => !before.has(id)));
  if (freshIds.size === 0 && now.length === before.size) return { kind: "same", count: now.length };
  return { kind: "changed", freshIds, fresh: freshIds.size };
}

/** "Same 20 pieces, already read". Only said when every one of them was read. */
export function sameSetLine(manifest: ContextManifest): string | null {
  const { read, total } = readTally(manifest);
  if (total === 0 || read !== total) return null;
  return `Same ${total} ${total === 1 ? "piece" : "pieces"}, already read`;
}

export function freshLine(fresh: number): string | null {
  if (fresh <= 0) return null;
  return `${fresh} new`;
}

/** A picked video is never context: say so, never count it. */
export function videoLine(pickedVideos: number): string | null {
  if (pickedVideos <= 0) return null;
  return `${pickedVideos} ${kindNoun("video", pickedVideos)}, ${NOT_READ}`;
}

/** The pieces of the read set the answer cited, by distinct item. */
export function usedItems(
  manifest: ContextManifest,
  citedItemIds: readonly (string | null)[],
): ManifestItem[] {
  const cited = new Set(
    citedItemIds.filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  return manifest.items.filter((item) => item.id && cited.has(item.id) && itemWasRead(item));
}

/** "used 4 transcripts", or "used 3 pieces of work" when the kinds are mixed. */
export function usedPhrase(used: readonly ManifestItem[]): string | null {
  if (used.length === 0) return null;
  const kinds = new Set(used.map(displayKind));
  const kind: ReadingKind = kinds.size === 1 ? [...kinds][0]! : "item";
  return `used ${used.length} ${kindNoun(kind, used.length)}`;
}

/** D1: "Read 19 of 20 · used 4 transcripts". Tap opens the full list. */
export function receiptLine(
  manifest: ContextManifest,
  citedItemIds: readonly (string | null)[] = [],
): string {
  const { read, total } = readTally(manifest);
  if (total === 0) return manifest.brief_included ? "Read the brief" : "Nothing was read";
  const head = `Read ${read} of ${total}`;
  const used = usedPhrase(usedItems(manifest, citedItemIds));
  return used ? `${head} · ${used}` : head;
}

// The rows readFirmCorpus would return for the Kestrel Bay demo firm, as the seed writes them, so the firm graph and
// the firm map are tested through the same pure steps the live read takes: seed meta, reader rows,
// assembleFirmCorpus, then assembleFirmGraph, with no database.
import { DEMO_BOARDS } from "@/lib/demo-firm";
import { DEMO_PEOPLE } from "@/lib/demo-firm/people";
import { outcomeLine, seedMeta } from "@/lib/demo-firm/plan";
import type { DemoBoard } from "@/lib/demo-firm/types";
import type { FirmCorpus } from "@/lib/firm-corpus-shared";
import { assembleFirmCorpus, type FirmRows } from "@/lib/firm-corpus.server";
import { assembleFirmGraph, type FirmGraph } from "@/lib/firm-graph-shared";

/** Boards in the demo seed that are not shared with the firm. */
export const UNSHARED = ["b13", "b20", "b23", "b28"];

/** Opaque item ids, as real rows have (uuids), so an item key such as "int-park-gm" cannot look like a person. */
export const ITEM_IDS = new Map(
  DEMO_BOARDS.flatMap((board) => board.items.map((item) => `${board.key}:${item.key}`)).map(
    (key, index) => [key, `item-${index + 1}`],
  ),
);
export const itemId = (board: string, item: string) => ITEM_IDS.get(`${board}:${item}`)!;
export const idsOf = (board: string) =>
  new Set([...ITEM_IDS].filter(([key]) => key.startsWith(`${board}:`)).map(([, id]) => id));

/**
 * The board read asks only for boards shared with the firm; `includeUnsharedItems` adds the unshared boards' items
 * and placements anyway, to prove the assembler drops them without their board.
 */
export function demoRows(
  boards: DemoBoard[] = DEMO_BOARDS,
  options: { includeUnsharedItems?: boolean } = {},
): FirmRows {
  const shared = boards.filter((board) => board.sharedWithFirm);
  const source = options.includeUnsharedItems ? boards : shared;
  const items = source.flatMap((board) => board.items.map((item) => ({ board, item })));
  return {
    boards: shared.map((board) => ({
      id: board.key,
      title: board.title,
      brief: board.brief,
      owner_id: board.team[0]!,
      outcome: outcomeLine(board),
      created_at: `${board.start}T09:00:00Z`,
      clients: { name: board.client.name, quick_folder: false },
    })),
    placements: items
      .filter(({ item }) => item.placed !== false)
      .map(({ board, item }) => ({
        work_item_id: itemId(board.key, item.key),
        engagement_id: board.key,
      })),
    items: items.map(({ board, item }) => ({
      id: itemId(board.key, item.key),
      owner_id: item.author,
      type: item.type,
      title: item.title,
      display_title: null,
      visibility:
        item.visibility === "private" ? "private" : item.placed === false ? "unmapped" : "mapped",
      work_date: item.date,
      meta: { mime_type: "text/markdown", ...seedMeta(board, item) },
    })),
    extracts: items.map(({ board, item }) => ({
      work_item_id: itemId(board.key, item.key),
      summary: item.summary,
      decisions: item.decisions ?? null,
      entities: item.entities ?? null,
      created_at: `${item.date}T12:00:00Z`,
    })),
    showings: items.flatMap(({ board, item }) =>
      (item.shown ?? []).map((showing) => ({
        work_item_id: itemId(board.key, item.key),
        engagement_id: board.key,
        shown_on: showing.on,
        occasion: showing.occasion,
      })),
    ),
    people: DEMO_PEOPLE.map((person) => ({
      id: person.key,
      display_name: person.name,
      is_guest: false,
    })),
    askerBoards: [],
  };
}

export const corpusOf = (rows: FirmRows): FirmCorpus => assembleFirmCorpus("org-kestrel", rows);
export const graphOf = (rows: FirmRows): FirmGraph => assembleFirmGraph(corpusOf(rows));

/** Every person in the demo firm as a word to look for: key, full name, first name and surname. */
export const PERSON_WORDS = [
  ...new Set(
    DEMO_PEOPLE.flatMap((person) => [person.key, person.name, ...person.name.split(/\s+/)]),
  ),
];

export const mentions = (text: string, word: string) =>
  new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text);

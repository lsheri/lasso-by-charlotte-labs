/**
 * The firm brain as threads (Firm Brain Build Spec: Threads and Walk-throughs, step 2): one thread per engagement
 * shared with the firm, stitched to the others through the situation it answered and the methods it used. Pure and
 * computed per request from the corpus the firm reader returns, so it inherits every privacy floor there (shared
 * boards only, no private or Out items) and stores nothing: a board with sharing turned off is gone next time.
 *
 * The graph carries ids, vocabulary labels and the board's own title, client and lesson. It never carries an item's
 * title, summary or body, and never a person: the board lead and item authors stay out, and calls give a job title
 * only, so no node, label or id can name someone.
 */

import {
  METHOD_LABELS,
  METHODS,
  SITUATION_LABELS,
  SITUATIONS,
  type Method,
  type Situation,
} from "./engagement-tags";
import type { FirmCorpus, FirmItem } from "./firm-corpus-shared";
import { parseOutcome } from "./proposal-shared";

export type SituationNode = { id: Situation; label: string; threadIds: string[] };

export type MethodNode = { id: Method; label: string; threadIds: string[]; itemCount: number };

export type ThreadStop =
  /** What the client faced. `itemId` is the item that says so (the SOW), or null when nothing does and it reads "other". */
  | { kind: "situation"; situation: Situation; label: string; date: string; itemId: string | null }
  /** A method, dated by the first item on this board that used it. */
  | { kind: "method"; method: Method; label: string; date: string | null; itemIds: string[] }
  /** The close-out lesson, from the board outcome. Only on boards that have one. */
  | { kind: "lesson"; text: string; ranToPlan: boolean | null; extended: boolean | null }
  /** What the client saw, oldest showing first. Only on boards that showed something. */
  | { kind: "client_deck"; date: string | null; itemIds: string[] };

export type FirmThread = {
  /** The board id. */
  id: string;
  title: string;
  client: string | null;
  startedOn: string;
  situation: Situation;
  /** Situation, then methods by date, then lesson, then client deck. */
  stops: ThreadStop[];
};

export type FirmGraph = {
  situations: SituationNode[];
  methods: MethodNode[];
  threads: FirmThread[];
};

/** Dated before undated, then by id, so the same corpus in any order gives the same answer. */
function byDate(a: { date: string | null; id: string }, b: { date: string | null; id: string }): number {
  if (a.date !== b.date) {
    if (a.date === null) return 1;
    if (b.date === null) return -1;
    return a.date.localeCompare(b.date);
  }
  return a.id.localeCompare(b.id);
}

function shownToClient(item: FirmItem): boolean {
  return item.shown.length > 0 || item.stage === "shown_to_client";
}

function firstShown(item: FirmItem): string | null {
  return item.shown[0]?.on ?? item.date;
}

export function assembleFirmGraph(corpus: FirmCorpus): FirmGraph {
  const itemsOn = new Map<string, FirmItem[]>();
  for (const item of corpus.items) {
    const list = itemsOn.get(item.boardId) ?? [];
    list.push(item);
    itemsOn.set(item.boardId, list);
  }

  const boards = [...corpus.boards].sort((a, b) => a.startedOn.localeCompare(b.startedOn) || a.id.localeCompare(b.id));
  const threads: FirmThread[] = [];
  const methodItems = new Map<Method, number>();

  for (const board of boards) {
    const items = [...(itemsOn.get(board.id) ?? [])].sort(byDate);

    // One situation per engagement: the earliest item that names one (the SOW, on a seeded board), else "other".
    const carrier = items.find((item) => item.situation);
    const situation: Situation = carrier?.situation ?? "other";
    const stops: ThreadStop[] = [
      { kind: "situation", situation, label: SITUATION_LABELS[situation], date: board.startedOn, itemId: carrier?.id ?? null },
    ];

    const used = new Map<Method, string[]>();
    for (const item of items) {
      for (const method of item.methods ?? []) {
        used.set(method, [...(used.get(method) ?? []), item.id]);
        methodItems.set(method, (methodItems.get(method) ?? 0) + 1);
      }
    }
    const dated = [...used].map(([method, itemIds]) => ({
      method,
      itemIds,
      // Items are already in date order, so the first one is the first use.
      date: items.find((item) => item.id === itemIds[0])?.date ?? null,
    }));
    // Same-day methods keep vocabulary order.
    const order = (method: Method) => String(METHODS.indexOf(method)).padStart(2, "0");
    dated.sort((a, b) => byDate({ date: a.date, id: order(a.method) }, { date: b.date, id: order(b.method) }));
    for (const entry of dated) stops.push({ kind: "method", method: entry.method, label: METHOD_LABELS[entry.method], date: entry.date, itemIds: entry.itemIds });

    const outcome = parseOutcome(board.outcome);
    if (outcome.lesson) stops.push({ kind: "lesson", text: outcome.lesson, ranToPlan: outcome.ranToPlan, extended: outcome.extended });

    const shown = items
      .filter(shownToClient)
      .map((item) => ({ id: item.id, date: firstShown(item) }))
      .sort(byDate);
    if (shown.length) stops.push({ kind: "client_deck", date: shown[0]!.date, itemIds: shown.map((entry) => entry.id) });

    threads.push({ id: board.id, title: board.title, client: board.client, startedOn: board.startedOn, situation, stops });
  }

  const situations: SituationNode[] = SITUATIONS.map((id) => ({
    id,
    label: SITUATION_LABELS[id],
    threadIds: threads.filter((thread) => thread.situation === id).map((thread) => thread.id),
  })).filter((node) => node.threadIds.length > 0);

  const methods: MethodNode[] = METHODS.map((id) => ({
    id,
    label: METHOD_LABELS[id],
    threadIds: threads.filter((thread) => thread.stops.some((stop) => stop.kind === "method" && stop.method === id)).map((thread) => thread.id),
    itemCount: methodItems.get(id) ?? 0,
  })).filter((node) => node.threadIds.length > 0);

  return { situations, methods, threads };
}

/**
 * LIVE-1 (8 Nov 2026): a board always shows the live version.
 *
 * Until now a board read its saved rows once, on open. Any write from another
 * tab, another device, a teammate or Lasso itself left the open board stale,
 * and the next save on that row hit the version check ("A newer version of
 * this record was saved"). 26 such conflicts in 30 days, every one a single
 * person against their own stale copy.
 *
 * This listens to the board's own rows (nodes, frames, links) through
 * Supabase Realtime. A change is applied by re-reading the board through the
 * same path as Load latest, never by merging rows by hand. Rules:
 *   - a change whose version the board already holds is an echo and is ignored;
 *   - nothing moves while the person is dragging, resizing, typing or saving;
 *   - Realtime does not guarantee delivery, so reconnect, coming back online
 *     and returning to the tab always re-read the board.
 * Margin notes (workboard_annotations) are deliberately not streamed: they can
 * be private and need their own privacy review. Nothing here says who is
 * viewing the board.
 */

import { useEffect, useRef } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { LabFrame, LabLink, LabNode } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkboardDto } from "@/lib/canvas-lab-shared";

export const BOARD_LIVE_TABLES = ["workboard_nodes", "workboard_frames", "workboard_links"] as const;
export type BoardLiveTable = (typeof BOARD_LIVE_TABLES)[number];
export const BOARD_LIVE_DEBOUNCE_MS = 300;
export const BOARD_LIVE_HOLD_MS = 400;
export type BoardLiveTrigger = "change" | "reconnect" | "online" | "focus";

/** The ids and versions the open board holds, for echo checks on single rows. */
export function knownVersions(nodes: readonly LabNode[], frames: readonly LabFrame[], links: readonly LabLink[]): Map<string, number> {
  const known = new Map<string, number>();
  for (const node of nodes) if (node.durableId) known.set(node.durableId, node.durableVersion ?? 1);
  for (const frame of frames) if (frame.durableId) known.set(frame.durableId, frame.durableVersion ?? 1);
  for (const link of links) if (link.durableId) known.set(link.durableId, link.durableVersion ?? 1);
  return known;
}

/** Every row id in a board read, so rows the canvas never draws are not mistaken for news. */
export function boardRowIds(board: Pick<WorkboardDto, "nodes" | "frames" | "links">): Set<string> {
  return new Set([...board.nodes, ...board.frames, ...board.links].map((row) => row.id));
}

/**
 * True when a fresh read differs from what the open board holds:
 * a row newer than the board's copy, a row the board has never seen, or a
 * row the board holds that is gone (archived elsewhere).
 */
export function liveBoardChanged(fresh: Pick<WorkboardDto, "nodes" | "frames" | "links">, known: ReadonlyMap<string, number>, seenIds: ReadonlySet<string>): boolean {
  const freshIds = new Set<string>();
  for (const row of [...fresh.nodes, ...fresh.frames, ...fresh.links]) {
    freshIds.add(row.id);
    const held = known.get(row.id);
    if (held !== undefined ? row.version > held : !seenIds.has(row.id)) return true;
  }
  for (const id of known.keys()) if (!freshIds.has(id)) return true;
  return false;
}

/** A Realtime row is news only when it is newer than what the board holds. */
export function liveRowIsNew(row: { id?: unknown; version?: unknown } | null | undefined, known: ReadonlyMap<string, number>): boolean {
  if (!row || typeof row.id !== "string") return false;
  const version = typeof row.version === "number" ? row.version : null;
  const held = known.get(row.id);
  if (held === undefined) return true;
  return version === null || version > held;
}

/**
 * Subscribe while the board is open. `isBusy` holds a pending refresh while
 * the person is mid-gesture or a save is in flight; `refresh` re-reads and
 * reapplies the board and says whether anything changed.
 */
export function useBoardLive({
  boardId,
  enabled,
  known,
  isBusy,
  refresh,
}: {
  boardId: string | null | undefined;
  enabled: boolean;
  known: () => ReadonlyMap<string, number>;
  isBusy: () => boolean;
  refresh: (trigger: BoardLiveTrigger) => Promise<boolean>;
}) {
  const knownRef = useRef(known);
  knownRef.current = known;
  const busyRef = useRef(isBusy);
  busyRef.current = isBusy;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!enabled || !boardId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let pending: BoardLiveTrigger | null = null;
    let running = false;
    let wasDown = false;

    const flush = () => {
      timer = undefined;
      if (!live || !pending) return;
      if (running || busyRef.current()) { timer = setTimeout(flush, BOARD_LIVE_HOLD_MS); return; }
      const trigger = pending;
      pending = null;
      running = true;
      void refreshRef.current(trigger).catch(() => false).finally(() => { running = false; });
    };
    const schedule = (trigger: BoardLiveTrigger) => {
      // A resync outranks a single change: it covers anything missed.
      if (!pending || pending === "change") pending = trigger;
      if (timer === undefined) timer = setTimeout(flush, BOARD_LIVE_DEBOUNCE_MS);
    };

    const channel = supabase.channel(`board-live:${boardId}`);
    for (const table of BOARD_LIVE_TABLES) {
      channel.on(
        "postgres_changes" as never,
        { event: "*", schema: "public", table, filter: `workboard_id=eq.${boardId}` } as never,
        ((payload: { new?: { id?: unknown; version?: unknown } | null }) => {
          if (liveRowIsNew(payload.new, knownRef.current())) schedule("change");
        }) as never,
      );
    }
    channel.subscribe((status: string) => {
      if (!live) return;
      if (status === "SUBSCRIBED") {
        // Anything written between the board's first read and now, or while disconnected, is read again.
        schedule(wasDown ? "reconnect" : "change");
        wasDown = false;
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        wasDown = true;
      }
    });

    const onOnline = () => schedule("online");
    const onVisible = () => { if (document.visibilityState === "visible") schedule("focus"); };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      live = false;
      if (timer !== undefined) clearTimeout(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [boardId, enabled]);
}

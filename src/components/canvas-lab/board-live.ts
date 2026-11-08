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

/** LIVE-2: how long the live connection may be down before the server is tested. */
export const BOARD_LIVE_DOWN_GRACE_MS = 5_000;
/** LIVE-2: with live updates down but the server reachable, re-read this often. */
export const BOARD_LIVE_FALLBACK_POLL_MS = 30_000;

/**
 * LIVE-2: whether the board can be trusted as live.
 * offline: the server cannot be reached, so the board is shown as of syncedAt
 * and editing is paused. Live updates being blocked while the server answers
 * (some company networks block WebSockets) is NOT offline: the board stays
 * editable and re-reads itself on a timer instead.
 */
export type BoardConnection = { offline: boolean; syncedAt: number | null; offlineSince: number | null };
export const BOARD_CONNECTION_ONLINE: BoardConnection = { offline: false, syncedAt: null, offlineSince: null };

export function offlineDurationBand(ms: number): "under_30s" | "30s_to_5m" | "over_5m" {
  if (ms < 30_000) return "under_30s";
  if (ms < 300_000) return "30s_to_5m";
  return "over_5m";
}

/**
 * Subscribe while the board is open. `isBusy` holds a pending refresh while
 * the person is mid-gesture or a save is in flight; `refresh` re-reads and
 * reapplies the board, and rejects when the server cannot be reached.
 */
export function useBoardLive({
  boardId,
  enabled,
  known,
  isBusy,
  refresh,
  onConnection,
}: {
  boardId: string | null | undefined;
  enabled: boolean;
  known: () => ReadonlyMap<string, number>;
  isBusy: () => boolean;
  refresh: (trigger: BoardLiveTrigger) => Promise<boolean>;
  onConnection?: (state: BoardConnection) => void;
}) {
  const knownRef = useRef(known);
  knownRef.current = known;
  const busyRef = useRef(isBusy);
  busyRef.current = isBusy;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const connectionRef = useRef(onConnection);
  connectionRef.current = onConnection;

  useEffect(() => {
    if (!enabled || !boardId) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let downTimer: ReturnType<typeof setTimeout> | undefined;
    let poll: ReturnType<typeof setInterval> | undefined;
    let pending: BoardLiveTrigger | null = null;
    let running = false;
    let channelDown = false;
    let state: BoardConnection = { offline: false, syncedAt: Date.now(), offlineSince: null };

    const publish = (next: BoardConnection) => {
      if (next.offline === state.offline && next.syncedAt === state.syncedAt) return;
      state = next;
      connectionRef.current?.(state);
    };
    const browserOffline = () => typeof navigator !== "undefined" && navigator.onLine === false;
    const goOffline = () => { if (!state.offline) publish({ ...state, offline: true, offlineSince: Date.now() }); };
    const synced = () => publish({ offline: false, syncedAt: Date.now(), offlineSince: null });

    const flush = () => {
      timer = undefined;
      if (!live || !pending) return;
      if (running || busyRef.current()) { timer = setTimeout(flush, BOARD_LIVE_HOLD_MS); return; }
      const trigger = pending;
      pending = null;
      running = true;
      void refreshRef.current(trigger)
        .then(() => { if (live && !browserOffline()) synced(); })
        // The server did not answer: offline, unless this was only a single missed change.
        .catch(() => { if (live && (channelDown || browserOffline() || trigger !== "change")) goOffline(); })
        .finally(() => { running = false; });
    };
    const schedule = (trigger: BoardLiveTrigger) => {
      // A resync outranks a single change: it covers anything missed.
      if (!pending || pending === "change") pending = trigger;
      if (timer === undefined) timer = setTimeout(flush, BOARD_LIVE_DEBOUNCE_MS);
    };
    const stopFallback = () => {
      if (downTimer !== undefined) clearTimeout(downTimer);
      if (poll !== undefined) clearInterval(poll);
      downTimer = undefined;
      poll = undefined;
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
        schedule(channelDown ? "reconnect" : "change");
        channelDown = false;
        stopFallback();
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        if (channelDown) return;
        channelDown = true;
        // LIVE-2: after a grace period, test the server. A failed read means offline;
        // a good one means only live updates are blocked, so re-read on a timer.
        downTimer = setTimeout(() => {
          schedule("reconnect");
          poll = setInterval(() => schedule("reconnect"), BOARD_LIVE_FALLBACK_POLL_MS);
        }, BOARD_LIVE_DOWN_GRACE_MS);
      }
    });

    const onOnline = () => schedule("online");
    const onOffline = () => goOffline();
    const onVisible = () => { if (document.visibilityState === "visible") schedule("focus"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisible);
    if (browserOffline()) goOffline();

    return () => {
      live = false;
      if (timer !== undefined) clearTimeout(timer);
      stopFallback();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisible);
      void supabase.removeChannel(channel);
    };
  }, [boardId, enabled]);
}

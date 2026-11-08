/**
 * Canvas Lab Phase 3 Slice 1: durable Workboard query plus save pipeline.
 *
 * Save states are honest: idle (nothing durable yet), saving, saved, error,
 * forbidden, conflict. A conflict carries the newer row so the caller can
 * offer only Load latest or Retry my change; nothing auto-merges.
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useRef, useState } from "react";

import { getCanvasLabBoardFn, mutateCanvasLabBoardFn } from "@/lib/canvas-lab.functions";
import type { WorkboardCommand, WorkboardDto, WorkboardMutationResult, WorkboardRowSnapshot } from "@/lib/canvas-lab-shared";

/** Which durable thing a command touches, for honest error reporting. */
export type WorkboardCommandEntity = "board" | "frame" | "node" | "relationship";

export function commandEntityKind(command: WorkboardCommand): WorkboardCommandEntity {
  if (command.type === "materialize") return "board";
  if (command.type.startsWith("frame_")) return "frame";
  if (command.type.startsWith("link_")) return "relationship";
  return "node";
}

/** A reachability failure, kept apart from a real validation answer. */
export type WorkboardClientResult = WorkboardMutationResult | { status: "network_error"; message: string };

export type WorkboardSaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string; retry: WorkboardCommand; entityKind: WorkboardCommandEntity }
  | { status: "forbidden" }
  | { status: "conflict"; entityKind: "frame" | "node" | "link"; entityId: string; latestVersion: number; latest: WorkboardRowSnapshot; retry: WorkboardCommand };

export function canvasLabBoardQuery(engagementId: string, profileId: string | undefined) {
  return {
    queryKey: ["canvas-lab-board", engagementId, profileId ?? ""],
    queryFn: async () => {
      const result = await getCanvasLabBoardFn({ data: { engagement_id: engagementId, ...(profileId ? { profile_id: profileId } : {}) } });
      return result as WorkboardDto | null;
    },
    enabled: !!engagementId,
    staleTime: 10_000,
  };
}

export function useCanvasLab(engagementId: string, profileId: string | undefined, orgId: string | undefined) {
  const queryClient = useQueryClient();
  const mutateFn = useServerFn(mutateCanvasLabBoardFn);
  const [saveState, setSaveState] = useState<WorkboardSaveState>({ status: "idle" });
  const boardRef = useRef<WorkboardDto | null>(null);
  /** LIVE-1: saves in flight and when the last one settled, so a live refresh never lands mid-save. */
  const inFlightRef = useRef(0);
  const settledAtRef = useRef(0);

  const query = useQuery(canvasLabBoardQuery(engagementId, profileId));
  if (query.data && boardRef.current !== query.data) boardRef.current = query.data;

  const persist = useCallback(
    async (command: WorkboardCommand): Promise<WorkboardClientResult> => {
      // LIVE-2: with no connection, fail at once instead of waiting on a request that cannot land.
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const offline = { status: "network_error", message: "You're offline. This change was not saved." } as const;
        setSaveState({ status: "error", message: offline.message, retry: command, entityKind: commandEntityKind(command) });
        return offline;
      }
      setSaveState({ status: "saving" });
      let result: WorkboardClientResult;
      inFlightRef.current += 1;
      try {
        result = (await mutateFn({ data: { engagement_id: engagementId, command, ...(profileId ? { profile_id: profileId } : {}) } })) as WorkboardMutationResult;
      } catch {
        result = { status: "network_error", message: "Could not reach the record." };
      } finally {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        settledAtRef.current = Date.now();
      }
      if (result.status === "saved") {
        setSaveState({ status: "saved" });
        void queryClient.invalidateQueries({ queryKey: ["canvas-lab-board", engagementId] });
        return result;
      }
      if (result.status === "conflict") {
        setSaveState({ status: "conflict", entityKind: result.entityKind, entityId: result.entityId, latestVersion: result.latestVersion, latest: result.latest, retry: command });
        return result;
      }
      if (result.status === "forbidden") {
        setSaveState({ status: "forbidden" });
        return result;
      }
      setSaveState({ status: "error", message: result.message, retry: command, entityKind: commandEntityKind(command) });
      return result;
    },
    [engagementId, mutateFn, profileId, queryClient],
  );

  const clearSaveState = useCallback(() => setSaveState({ status: boardRef.current?.id ? "saved" : "idle" }), []);

  /** Read the durable board again, so a reconcile sees every entity kind. */
  const refresh = useCallback(async (): Promise<WorkboardDto | null> => {
    // Always a fresh read: a cached copy up to 10 seconds old is exactly the stale board this exists to replace.
    const fresh = (await queryClient.fetchQuery({ ...canvasLabBoardQuery(engagementId, profileId), staleTime: 0, retry: 1 })) as WorkboardDto | null;
    boardRef.current = fresh;
    return fresh;
  }, [engagementId, profileId, queryClient]);

  /** LIVE-1: true while a save is in flight or just settled (a group move saves one row after another). */
  const isSaving = useCallback((quietMs = 400) => inFlightRef.current > 0 || Date.now() - settledAtRef.current < quietMs, []);

  return { board: query.data ?? null, boardLoading: query.isLoading, saveState, persist, clearSaveState, refresh, isSaving, orgId };
}


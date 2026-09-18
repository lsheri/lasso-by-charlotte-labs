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

export type WorkboardSaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string }
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

  const query = useQuery(canvasLabBoardQuery(engagementId, profileId));
  if (query.data && boardRef.current !== query.data) boardRef.current = query.data;

  const persist = useCallback(
    async (command: WorkboardCommand): Promise<WorkboardMutationResult> => {
      setSaveState({ status: "saving" });
      let result: WorkboardMutationResult;
      try {
        result = (await mutateFn({ data: { engagement_id: engagementId, command, ...(profileId ? { profile_id: profileId } : {}) } })) as WorkboardMutationResult;
      } catch {
        result = { status: "validation_error", message: "Could not reach the record." };
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
      setSaveState({ status: "error", message: result.message });
      return result;
    },
    [engagementId, mutateFn, profileId, queryClient],
  );

  const clearSaveState = useCallback(() => setSaveState({ status: boardRef.current?.id ? "saved" : "idle" }), []);

  return { board: query.data ?? null, boardLoading: query.isLoading, saveState, persist, clearSaveState, orgId };
}

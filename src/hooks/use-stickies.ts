/**
 * S2 (stickies on the work): the stickies on one piece of work on one board. Every write names the piece
 * it was made on, so a view that has since moved on to another piece can never redirect it (the lesson of
 * T2c-1's review).
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import type { AnnotationVisibility } from "@/lib/canvas-lab-annotations-shared";
import type { WorkboardStickyFill } from "@/lib/canvas-lab-shared";
import type { StickyAnchor, StickyDto, StickyMutationResult } from "@/lib/stickies-shared";
import {
  archiveStickyFn,
  createStickyFn,
  editStickyFn,
  listStickiesFn,
} from "@/lib/stickies.functions";

export function stickiesQueryKey(engagementId: string, workItemId: string) {
  return ["workboard-stickies", engagementId, workItemId] as const;
}

export type NewSticky = {
  workItemId: string;
  anchor: StickyAnchor;
  posX: number;
  posY: number;
  fill: WorkboardStickyFill;
  body: string;
  visibility: AnnotationVisibility;
  clientKey: string;
};

export type StickyEdit = {
  workItemId: string;
  id: string;
  expectedVersion: number;
  body?: string | undefined;
  fill?: WorkboardStickyFill | undefined;
  visibility?: AnnotationVisibility | undefined;
  posX?: number | undefined;
  posY?: number | undefined;
};

export function useStickies(
  engagementId: string,
  workItemId: string | null,
  profileId?: string | undefined,
) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listStickiesFn);
  const createFn = useServerFn(createStickyFn);
  const editFn = useServerFn(editStickyFn);
  const archiveFn = useServerFn(archiveStickyFn);
  const who = profileId ? { profile_id: profileId } : {};

  const query = useQuery({
    queryKey: stickiesQueryKey(engagementId, workItemId ?? ""),
    enabled: !!engagementId && !!workItemId,
    queryFn: async (): Promise<StickyDto[]> =>
      (await listFn({
        data: { engagement_id: engagementId, work_item_id: workItemId ?? "", ...who },
      })) as StickyDto[],
  });

  const invalidateFor = useCallback(
    (pieceId: string) =>
      void queryClient.invalidateQueries({ queryKey: stickiesQueryKey(engagementId, pieceId) }),
    [engagementId, queryClient],
  );

  const create = useMutation({
    mutationFn: async (input: NewSticky): Promise<StickyMutationResult> =>
      (await createFn({
        data: {
          engagement_id: engagementId,
          work_item_id: input.workItemId,
          anchor: input.anchor,
          pos_x: input.posX,
          pos_y: input.posY,
          fill: input.fill,
          body: input.body,
          visibility: input.visibility,
          client_key: input.clientKey,
          ...who,
        },
      })) as StickyMutationResult,
    onSuccess: (_result, input) => invalidateFor(input.workItemId),
  });

  const edit = useMutation({
    mutationFn: async (input: StickyEdit): Promise<StickyMutationResult> =>
      (await editFn({
        data: {
          id: input.id,
          expected_version: input.expectedVersion,
          ...(input.body !== undefined ? { body: input.body } : {}),
          ...(input.fill !== undefined ? { fill: input.fill } : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          ...(input.posX !== undefined ? { pos_x: input.posX } : {}),
          ...(input.posY !== undefined ? { pos_y: input.posY } : {}),
          ...who,
        },
      })) as StickyMutationResult,
    onSuccess: (_result, input) => invalidateFor(input.workItemId),
  });

  const archive = useMutation({
    mutationFn: async (input: {
      workItemId: string;
      id: string;
      expectedVersion: number;
    }): Promise<StickyMutationResult> =>
      (await archiveFn({
        data: { id: input.id, expected_version: input.expectedVersion, ...who },
      })) as StickyMutationResult,
    onSuccess: (_result, input) => invalidateFor(input.workItemId),
  });

  return {
    stickies: query.data ?? [],
    loading: query.isLoading,
    createSticky: create.mutateAsync,
    editSticky: edit.mutateAsync,
    archiveSticky: archive.mutateAsync,
  };
}

/**
 * Slice 2a unit 1: the caller's own highlights for one chat on one workboard.
 * Private to the author, so the cache key carries no other person's identity.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import type {
  AnnotationMutationResult,
  AnnotationVisibility,
  HighlightDto,
} from "@/lib/canvas-lab-annotations-shared";
import {
  archiveHighlightFn,
  createHighlightFn,
  listMyAnnotationsFn,
  setHighlightVisibilityFn,
} from "@/lib/canvas-lab.functions";


export function annotationsQueryKey(engagementId: string, workItemId: string) {
  return ["workboard-annotations", engagementId, workItemId] as const;
}

export function useCanvasLabAnnotations(
  engagementId: string,
  workItemId: string | null,
  profileId?: string | undefined,
) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listMyAnnotationsFn);
  const createFn = useServerFn(createHighlightFn);
  const archiveFn = useServerFn(archiveHighlightFn);

  const query = useQuery({
    queryKey: annotationsQueryKey(engagementId, workItemId ?? ""),
    enabled: !!engagementId && !!workItemId,
    queryFn: async (): Promise<HighlightDto[]> =>
      (await listFn({
        data: {
          engagement_id: engagementId,
          work_item_id: workItemId ?? "",
          ...(profileId ? { profile_id: profileId } : {}),
        },
      })) as HighlightDto[],
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: annotationsQueryKey(engagementId, workItemId ?? "") });
  }, [engagementId, queryClient, workItemId]);

  const create = useMutation({
    mutationFn: async (input: {
      turnNo: number;
      charStart: number;
      charEnd: number;
      clientKey: string;
    }): Promise<AnnotationMutationResult> =>
      (await createFn({
        data: {
          engagement_id: engagementId,
          work_item_id: workItemId ?? "",
          turn_no: input.turnNo,
          char_start: input.charStart,
          char_end: input.charEnd,
          client_key: input.clientKey,
          ...(profileId ? { profile_id: profileId } : {}),
        },
      })) as AnnotationMutationResult,
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (input: { id: string; expectedVersion: number }): Promise<AnnotationMutationResult> =>
      (await archiveFn({
        data: {
          id: input.id,
          expected_version: input.expectedVersion,
          ...(profileId ? { profile_id: profileId } : {}),
        },
      })) as AnnotationMutationResult,
    onSuccess: invalidate,
  });

  return {
    highlights: query.data ?? [],
    loading: query.isLoading,
    createHighlight: create.mutateAsync,
    archiveHighlight: archive.mutateAsync,
    refresh: invalidate,
  };
}

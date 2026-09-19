/**
 * Slice 2a unit 2: comments on one chat, and the count behind each card's chip.
 * A comment is review, so the cache key is the item rather than the reader.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback } from "react";

import type { CommentMutationResult, CommentThreadDto } from "@/lib/canvas-lab-annotations-shared";
import {
  archiveCommentFn,
  createCommentFn,
  createReplyFn,
  editCommentFn,
  listCommentCountsFn,
  listCommentsFn,
} from "@/lib/canvas-lab.functions";

export function commentsQueryKey(engagementId: string, workItemId: string) {
  return ["workboard-comments", engagementId, workItemId] as const;
}

export function commentCountsQueryKey(engagementId: string) {
  return ["workboard-comment-counts", engagementId] as const;
}

export function useWorkboardCommentCounts(engagementId: string, profileId?: string | undefined) {
  const countsFn = useServerFn(listCommentCountsFn);
  const query = useQuery({
    queryKey: commentCountsQueryKey(engagementId),
    enabled: !!engagementId,
    queryFn: async (): Promise<Record<string, number>> =>
      (await countsFn({
        data: { engagement_id: engagementId, ...(profileId ? { profile_id: profileId } : {}) },
      })) as Record<string, number>,
  });
  return query.data ?? {};
}

export function useCanvasLabComments(
  engagementId: string,
  workItemId: string | null,
  profileId?: string | undefined,
) {
  const queryClient = useQueryClient();
  const listFn = useServerFn(listCommentsFn);
  const createFn = useServerFn(createCommentFn);
  const replyFn = useServerFn(createReplyFn);
  const editFn = useServerFn(editCommentFn);
  const archiveFn = useServerFn(archiveCommentFn);
  const profileArg = profileId ? { profile_id: profileId } : {};

  const query = useQuery({
    queryKey: commentsQueryKey(engagementId, workItemId ?? ""),
    enabled: !!engagementId && !!workItemId,
    queryFn: async (): Promise<CommentThreadDto[]> =>
      (await listFn({
        data: { engagement_id: engagementId, work_item_id: workItemId ?? "", ...profileArg },
      })) as CommentThreadDto[],
  });

  /** Any change moves both the thread list and the chip on the card. */
  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: commentsQueryKey(engagementId, workItemId ?? "") });
    void queryClient.invalidateQueries({ queryKey: commentCountsQueryKey(engagementId) });
  }, [engagementId, queryClient, workItemId]);

  const create = useMutation({
    mutationFn: async (input: {
      turnNo: number;
      charStart: number;
      charEnd: number;
      body: string;
      clientKey: string;
    }): Promise<CommentMutationResult> =>
      (await createFn({
        data: {
          engagement_id: engagementId,
          work_item_id: workItemId ?? "",
          turn_no: input.turnNo,
          char_start: input.charStart,
          char_end: input.charEnd,
          body: input.body,
          client_key: input.clientKey,
          ...profileArg,
        },
      })) as CommentMutationResult,
    onSuccess: invalidate,
  });

  const reply = useMutation({
    mutationFn: async (input: { parentId: string; body: string; clientKey: string }): Promise<CommentMutationResult> =>
      (await replyFn({
        data: { parent_id: input.parentId, body: input.body, client_key: input.clientKey, ...profileArg },
      })) as CommentMutationResult,
    onSuccess: invalidate,
  });

  const edit = useMutation({
    mutationFn: async (input: { id: string; body: string; expectedVersion: number }): Promise<CommentMutationResult> =>
      (await editFn({
        data: { id: input.id, body: input.body, expected_version: input.expectedVersion, ...profileArg },
      })) as CommentMutationResult,
    onSuccess: invalidate,
  });

  const archive = useMutation({
    mutationFn: async (input: { id: string; expectedVersion: number }): Promise<CommentMutationResult> =>
      (await archiveFn({
        data: { id: input.id, expected_version: input.expectedVersion, ...profileArg },
      })) as CommentMutationResult,
    onSuccess: invalidate,
  });

  return {
    threads: query.data ?? [],
    loading: query.isLoading,
    createComment: create.mutateAsync,
    createReply: reply.mutateAsync,
    editComment: edit.mutateAsync,
    archiveComment: archive.mutateAsync,
    refresh: invalidate,
  };
}

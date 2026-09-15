import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * PASS D — the notes a person has not opened yet, and the conversation that
 * hangs off one note.
 *
 * One query answers every surface that draws a circle: the sidebar, the
 * engagement bench and the notes page all read the same key.
 */

export type UnreadNote = {
  id: string;
  created_at: string;
  did_well: string;
  would_try: string;
  watch_next: string;
  engagement_id: string | null;
  task_id: string | null;
  work_item_id: string | null;
  profiles: { display_name: string } | null;
};

const UNREAD_SELECT =
  "id, created_at, did_well, would_try, watch_next, engagement_id, task_id, work_item_id, profiles!coaching_notes_author_id_fkey(display_name)";

export function unreadNotesKey(subjectId: string | undefined) {
  return ["coachnotes-unread", subjectId] as const;
}

export async function fetchUnreadNotes(subjectId: string): Promise<UnreadNote[]> {
  const { data, error } = await supabase
    .from("coaching_notes")
    .select(UNREAD_SELECT)
    .eq("subject_id", subjectId)
    .is("read_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as UnreadNote[];
}

/**
 * Notes about this person that they have not opened. A coach never calls this
 * with their own id: a coach has no circles anywhere in the product.
 */
export function useUnreadNotesAboutMe(subjectId: string | undefined) {
  return useQuery({
    queryKey: unreadNotesKey(subjectId),
    queryFn: () => fetchUnreadNotes(subjectId as string),
    enabled: Boolean(subjectId),
  });
}

export type NoteReply = {
  id: string;
  note_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

export function useNoteReplies(noteId: string | undefined) {
  return useQuery({
    queryKey: ["coachnote-replies", noteId],
    enabled: Boolean(noteId),
    queryFn: async (): Promise<NoteReply[]> => {
      const { data, error } = await supabase
        .from("coaching_note_replies")
        .select("id, note_id, author_id, body, created_at")
        .eq("note_id", noteId as string)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NoteReply[];
    },
  });
}

export function useSendNoteReply(noteId: string | undefined, authorId: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await supabase.from("coaching_note_replies").insert({
        note_id: noteId as string,
        author_id: authorId as string,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["coachnote-replies", noteId] }),
  });
}

/**
 * The subject's read mark, written once by the database function. A coach
 * calling this changes nothing: the function checks who is asking.
 */
export async function markNoteRead(noteId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_coaching_note_read", { p_note_id: noteId });
  if (error) throw error;
}

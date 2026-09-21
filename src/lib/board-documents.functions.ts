import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  documentPlainText,
  emptyDocumentContent,
  NEW_DOCUMENT_TITLE,
} from "@/lib/board-documents-shared";
import { resolveProfile } from "@/lib/profile-resolve";

export type BoardDocumentRow = {
  id: string;
  task_id: string;
  title: string;
  content: { text: string };
  created_at: string;
  updated_at: string;
};

type TaskInput = { task_id: string; profile_id?: string | null | undefined };

function validate(input: TaskInput): TaskInput {
  if (!input?.task_id) throw new Error("task_id is required");
  return { task_id: input.task_id, profile_id: input.profile_id ?? null };
}

/** The one document a workstream may carry, or nothing. Access is the board's. */
export const boardDocumentForTask = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<BoardDocumentRow | null> => {
    const { data: row } = await context.supabase
      .from("board_documents")
      .select("id, task_id, title, content, created_at, updated_at")
      .eq("task_id", data.task_id)
      .maybeSingle();
    if (!row) return null;
    return { ...(row as BoardDocumentRow), content: { text: documentPlainText(row.content) } };
  });

/** One empty document on a workstream that has none. The schema allows only one. */
export const createBoardDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate)
  .handler(async ({ data, context }): Promise<BoardDocumentRow> => {
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });

    const { data: row, error } = await context.supabase
      .from("board_documents")
      .insert({
        task_id: data.task_id,
        title: NEW_DOCUMENT_TITLE,
        content: emptyDocumentContent(),
        author_profile_id: profile.id,
      })
      .select("id, task_id, title, content, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { ...(row as BoardDocumentRow), content: { text: documentPlainText(row.content) } };
  });

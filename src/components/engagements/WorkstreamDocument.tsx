import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { documentPlainText } from "@/lib/board-documents-shared";
import { boardDocumentForTask, createBoardDocument } from "@/lib/board-documents.functions";
import { logEvent } from "@/lib/telemetry";

/**
 * The workstream's own note, read only in this unit. It is written by people
 * and read by people, and it is never part of the record a question is
 * answered from.
 */
export function WorkstreamDocument({
  taskId,
  canEdit,
  profile,
}: {
  taskId: string;
  canEdit: boolean;
  profile: { id: string; org_id: string } | null | undefined;
}) {
  const queryClient = useQueryClient();
  const load = useServerFn(boardDocumentForTask);
  const create = useServerFn(createBoardDocument);

  const { data: document, isLoading } = useQuery({
    queryKey: ["board-document", taskId],
    queryFn: () => load({ data: { task_id: taskId } }),
  });

  const start = useMutation({
    mutationFn: () => create({ data: { task_id: taskId, profile_id: profile?.id ?? null } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["board-document", taskId] });
      if (profile?.org_id) logEvent("workboard.document_created", profile.org_id, { via: "workstream" });
    },
  });

  if (isLoading) return null;

  if (!document) {
    if (!canEdit) return null;
    return (
      <button
        type="button"
        disabled={start.isPending}
        onClick={() => start.mutate()}
        className="nb-type-small text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
      >
        Start a note
      </button>
    );
  }

  const text = documentPlainText(document.content);

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-background px-3 py-2">
      <p className="nb-type-small font-medium text-foreground">{document.title}</p>
      {text ? (
        <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{text}</p>
      ) : (
        <p className="mt-1 nb-type-small text-muted-foreground">Nothing written yet.</p>
      )}
    </div>
  );
}

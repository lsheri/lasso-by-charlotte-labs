import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { invalidateAfterWorkChange } from "@/lib/work-invalidation";
import { deleteWorkItem } from "@/lib/work-remove.functions";

export const DELETE_LABEL = "Delete this work";
export const DELETE_PERMANENCE_LINE =
  "Deletes this work and its captured record: transcript turns, extracted text, analysis links and stitches that point at it. This cannot be undone.";

/**
 * Two steps, because the first click is often the hand and not the intent. The
 * second step states plainly what goes, and there is no trash to fish it out of.
 */
export function DeleteWorkItemDialog({
  workItemId,
  title,
  open,
  onOpenChange,
  onDone,
}: {
  workItemId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const run = useServerFn(deleteWorkItem);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);

  useEffect(() => {
    if (!open) setSure(false);
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{sure ? "Delete it permanently?" : `Delete “${title}”?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {DELETE_PERMANENCE_LINE}
            {sure ? " Deleting now removes the stored file as well." : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              if (!sure) {
                setSure(true);
                return;
              }
              setBusy(true);
              void run({ data: { work_item_id: workItemId } })
                .then(async () => {
                  toast.success("Deleted.");
                  await invalidateAfterWorkChange(queryClient, workItemId);
                  onDone?.();
                  onOpenChange(false);
                })
                .catch((error: unknown) => toast.error((error as Error).message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Deleting…" : sure ? "Yes, delete permanently" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

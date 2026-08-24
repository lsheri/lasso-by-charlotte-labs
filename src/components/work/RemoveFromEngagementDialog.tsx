import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
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
import { removeItemFromEngagement } from "@/lib/work-remove.functions";

export const REMOVE_LABEL = "Remove from this engagement";
export const REMOVE_HELP = "Goes back to your Work pile. Nothing is deleted.";

/**
 * Soft and reversible: the mapping rows for this engagement go, the work does
 * not. If the item is mapped somewhere else too, we say so rather than promise
 * it will reappear in the pile.
 */
export function RemoveFromEngagementDialog({
  workItemId,
  title,
  engagementId,
  open,
  onOpenChange,
  onDone,
}: {
  workItemId: string;
  title: string;
  engagementId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone?: (() => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const run = useServerFn(removeItemFromEngagement);
  const [busy, setBusy] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{REMOVE_LABEL}</AlertDialogTitle>
          <AlertDialogDescription>
            {REMOVE_HELP} “{title}” stays in your record exactly as it is.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it here</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              setBusy(true);
              void run({ data: { work_item_id: workItemId, engagement_id: engagementId } })
                .then(async (result) => {
                  toast.success(
                    result.still_mapped_elsewhere
                      ? "Removed here. It stays mapped in another engagement."
                      : "Back in your Work pile.",
                  );
                  await invalidateAfterWorkChange(queryClient, workItemId);
                  onDone?.();
                  onOpenChange(false);
                })
                .catch((error: unknown) => toast.error((error as Error).message))
                .finally(() => setBusy(false));
            }}
          >
            {busy ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

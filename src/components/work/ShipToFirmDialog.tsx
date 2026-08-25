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
import { useShipWork } from "@/hooks/use-shipped-work";
import {
  SHIP_CONFIRM_BODY,
  SHIP_CONFIRM_PRIMARY,
  SHIP_CONFIRM_SECONDARY,
  SHIP_CONFIRM_TITLE,
} from "@/lib/shipped-work-shared";

/**
 * Shipping always passes through here, so nothing unfinished lands in the
 * archive by a stray click, and so the person reads what the firm will see.
 */
export function ShipToFirmDialog({
  workItemId,
  title,
  engagementId,
  open,
  onOpenChange,
}: {
  workItemId: string;
  title: string;
  engagementId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const ship = useShipWork();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{SHIP_CONFIRM_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>{SHIP_CONFIRM_BODY}</AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2">
          <p className="break-words text-sm font-medium text-foreground">{title}</p>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={ship.isPending}>
            {SHIP_CONFIRM_SECONDARY}
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={ship.isPending}
            onClick={(event) => {
              event.preventDefault();
              ship
                .mutateAsync({ workItemId, engagementId })
                .then(() => {
                  toast.success("Shipped to the firm archive.");
                  onOpenChange(false);
                })
                .catch((error: unknown) => toast.error((error as Error).message));
            }}
          >
            {ship.isPending ? "Shipping…" : SHIP_CONFIRM_PRIMARY}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

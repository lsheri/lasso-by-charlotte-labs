import { useEffect, useRef, useState } from "react";
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
import { useScribbleComplete } from "@/lib/scribble-complete";
import {
  SHIP_CONFIRM_BODY,
  SHIP_CONFIRM_PRIMARY,
  SHIP_CONFIRM_SECONDARY,
  SHIP_CONFIRM_TITLE,
} from "@/lib/shipped-work-shared";

type Settled = { ok: true } | { ok: false; message: string };

/**
 * Shipping always passes through here, so nothing unfinished lands in the
 * archive by a stray click, and so the person reads what the firm will see.
 * When it lands, the name is crossed off in graphite and the dialog leaves:
 * the work is done, not merely gone.
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
  const rowRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<Promise<Settled> | null>(null);
  const [shipping, setShipping] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scribble = useScribbleComplete({
    targetRef: rowRef,
    seed: workItemId,
    onDone: () => {
      // Never close on the animation alone: the server has the last word.
      void pendingRef.current?.then((result) => {
        if (!result.ok) return;
        toast.success("Shipped to the firm archive.");
        onOpenChange(false);
      });
    },
  });

  const resetScribble = scribble.reset;
  useEffect(() => {
    if (open) return;
    pendingRef.current = null;
    setShipping(false);
    setError(null);
    resetScribble();
    // Resetting on close is what keeps a scribble from resting anywhere.
  }, [open, resetScribble]);

  const start = () => {
    setError(null);
    setShipping(true);
    const pending: Promise<Settled> = ship
      .mutateAsync({ workItemId, engagementId })
      .then(() => ({ ok: true }) as Settled)
      .catch((err: unknown) => ({ ok: false, message: (err as Error).message }) as Settled);
    pendingRef.current = pending;
    void pending.then((result) => {
      if (result.ok) return;
      // Null the pending handle first: the settle timer must not still play.
      pendingRef.current = null;
      scribble.reset();
      setShipping(false);
      setError(result.message);
    });
    // t=0 to 120: the name row settles before the pencil crosses it off.
    window.setTimeout(() => {
      if (pendingRef.current === pending) scribble.play();
    }, 120);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{SHIP_CONFIRM_TITLE}</AlertDialogTitle>
          <AlertDialogDescription>{SHIP_CONFIRM_BODY}</AlertDialogDescription>
        </AlertDialogHeader>
        <div
          ref={rowRef}
          data-testid="ship-name-row"
          className={`relative rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 ${
            shipping ? "nb-ship-settle" : ""
          }`}
        >
          <p className="break-words text-sm font-medium text-foreground">{title}</p>
          {scribble.overlay}
        </div>
        {error ? (
          <p data-testid="ship-error" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={shipping}>{SHIP_CONFIRM_SECONDARY}</AlertDialogCancel>
          <AlertDialogAction
            disabled={shipping}
            className={shipping ? "scale-[0.98] transition-transform duration-[80ms]" : ""}
            onClick={(event) => {
              event.preventDefault();
              start();
            }}
          >
            {shipping ? "Shipping…" : SHIP_CONFIRM_PRIMARY}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

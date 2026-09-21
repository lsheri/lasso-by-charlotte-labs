import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { useProfile } from "@/hooks/use-profile";
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
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { invalidateAfterWorkChange } from "@/lib/work-invalidation";
import { deleteWorkItem } from "@/lib/work-remove.functions";

export const DELETE_LABEL = "Delete this work";
/** PASS 129 — the consequence, said in one plain line before anything else. */
export const DELETE_CONSEQUENCE_LINE = "This deletes the work and its record. There is no undo.";
export const DELETE_PERMANENCE_LINE =
  "Deletes this work and its captured record: transcript turns, extracted text, analysis links and stitches that point at it. This cannot be undone.";
/** Step two says what goes with it, in the words a person would use. */
export const DELETE_SCOPE_LINE =
  "This deletes the work, its transcript and extracted text. It also comes off every workboard it's on. Notes people wrote on it stay with their authors, marked as source removed. There is no undo.";
export const DELETE_CONFIRM_LABEL = "Type the name to confirm";
export const DELETE_LEGAL_HOLD_LINE = "This work is under a legal hold and can't be deleted.";

/** Trim, collapse inner runs of whitespace, ignore case. */
export function normalizeConfirmName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function confirmMatches(typed: string, title: string): boolean {
  const target = normalizeConfirmName(title);
  return target.length > 0 && normalizeConfirmName(typed) === target;
}

function isLegalHold(error: unknown): boolean {
  return ((error as Error | null)?.message ?? "").toLowerCase().includes("legal hold");
}

/**
 * Two steps, because the first click is often the hand and not the intent. The
 * second step states plainly what goes, and asks for the name in full.
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
  const { data: profile } = useProfile();
  const run = useServerFn(deleteWorkItem);
  const [busy, setBusy] = useState(false);
  const [sure, setSure] = useState(false);
  const [typed, setTyped] = useState("");
  const [boardCount, setBoardCount] = useState(0);

  useEffect(() => {
    if (!open) {
      setSure(false);
      setTyped("");
      return;
    }
    let live = true;
    void (async () => {
      try {
        const { count, error } = await supabase
          .from("workboard_nodes")
          .select("id", { count: "exact", head: true })
          .eq("work_item_id", workItemId);
        if (!live || error) return;
        setBoardCount(count ?? 0);
      } catch {
        /* the count is a courtesy; its absence never blocks the dialog */
      }
    })();
    return () => {
      live = false;
    };
  }, [open, workItemId]);

  const matches = confirmMatches(typed, title);

  function submit() {
    if (busy || !matches) return;
    setBusy(true);
    void run({ data: { work_item_id: workItemId, profile_id: profile?.id } })
      .then(async () => {
        if (profile?.org_id) logEvent("workitem.deleted", profile.org_id, { on_board: boardCount > 0 });
        toast.success("Deleted.");
        await invalidateAfterWorkChange(queryClient, workItemId);
        onDone?.();
        onOpenChange(false);
      })
      .catch((error: unknown) => {
        toast.error(isLegalHold(error) ? DELETE_LEGAL_HOLD_LINE : (error as Error).message);
      })
      .finally(() => setBusy(false));
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{sure ? "Delete it permanently?" : `Delete “${title}”?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {sure ? DELETE_SCOPE_LINE : `${DELETE_CONSEQUENCE_LINE} ${DELETE_PERMANENCE_LINE}`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {sure ? (
          <div className="space-y-2">
            {boardCount > 0 ? (
              <p className="font-mono text-[9px] uppercase tracking-[0.08em] text-muted-foreground">
                On {boardCount} workboard{boardCount === 1 ? "" : "s"}
              </p>
            ) : null}
            <p className="text-[13px] leading-[18px] text-foreground">{title}</p>
            <label className="block nb-type-small text-muted-foreground" htmlFor="delete-work-confirm">
              {DELETE_CONFIRM_LABEL}
            </label>
            <Input
              id="delete-work-confirm"
              value={typed}
              autoComplete="off"
              disabled={busy}
              onChange={(event) => setTyped(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Keep it</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy || (sure && !matches)}
            onClick={(event) => {
              event.preventDefault();
              if (!sure) {
                setSure(true);
                return;
              }
              submit();
            }}
          >
            {busy ? "Deleting…" : sure ? "Delete permanently" : "Continue"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

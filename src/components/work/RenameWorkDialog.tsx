import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { displayName, normalizeDisplayTitle } from "@/lib/work-item-name";

export const RENAME_COPY = {
  menu: "Rename for others",
  title: "Rename for others",
  helper: "This is the name other people see. The original is kept.",
  label: "Name",
  save: "Save",
  cancel: "Cancel",
  failed: "Could not save the name. Try again.",
} as const;

/** WI-1: the owner chooses the name other people see. title is never written. */
export function RenameWorkDialog({
  item,
  orgId,
  open,
  onOpenChange,
  onSaved,
}: {
  item: { id: string; title: string; display_title?: string | null | undefined };
  orgId?: string | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: ((displayTitle: string | null) => void) | undefined;
}) {
  const queryClient = useQueryClient();
  const [value, setValue] = useState(displayName(item));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setValue(displayName(item));
  }, [open, item]);

  async function save() {
    const next = normalizeDisplayTitle(value, item.title);
    setBusy(true);
    const { error } = await supabase.from("work_items").update({ display_title: next }).eq("id", item.id);
    setBusy(false);
    if (error) {
      toast.error(RENAME_COPY.failed);
      return;
    }
    if (orgId) logEvent("workitem.renamed", orgId, { cleared: next === null ? "true" : "false" });
    onSaved?.(next);
    onOpenChange(false);
    void queryClient.invalidateQueries();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{RENAME_COPY.title}</DialogTitle>
          <DialogDescription>{RENAME_COPY.helper}</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <Input aria-label={RENAME_COPY.label} value={value} onChange={(event) => setValue(event.target.value)} autoFocus />
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {RENAME_COPY.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {RENAME_COPY.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProfile } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { formatDate, type WorkItemRow } from "@/lib/work-types";

/** Parse a `date` column value without letting the local timezone shift the day. */
function parseDateOnly(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

export function WorkDateDialog({
  item,
  open,
  onOpenChange,
}: {
  item: WorkItemRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: profile } = useProfile();
  const queryClient = useQueryClient();
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDate(parseDateOnly(item?.work_date));
    setError(null);
  }, [item?.id, item?.work_date]);

  async function save(next: Date | undefined) {
    if (!item) return;
    setSaving(true);
    setError(null);
    const value = next ? format(next, "yyyy-MM-dd") : null;
    const { error: e } = await supabase
      .from("work_items")
      .update({ work_date: value })
      .eq("id", item.id);
    setSaving(false);
    if (e) {
      setError(e.message);
      return;
    }
    if (profile) logEvent("workitem.dated", profile.org_id, {});
    await queryClient.invalidateQueries({ queryKey: ["work-items"] });
    await queryClient.invalidateQueries({ queryKey: ["engagement-tasks"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Work date</DialogTitle>
          <DialogDescription>
            When this work actually happened. Change it anytime — the date it was added never
            changes.
          </DialogDescription>
        </DialogHeader>

        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          initialFocus
          className={cn("rounded-[var(--radius)] border border-border p-3 pointer-events-auto")}
        />

        {item ? (
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Added {formatDate(item.captured_at)}
          </p>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(undefined)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            Clear
          </button>
          <Button type="button" disabled={saving || !date} onClick={() => void save(date)}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  SAMPLE_BUTTON_LABEL,
  SAMPLE_INTRO_LINE,
  sampleEventForTier,
  tierLabel,
  type DataTier,
} from "@/lib/data-consent-shared";

/** One picture of what leaves at the level in force right now. */
export function SampleEventDialog({ tier }: { tier: DataTier }) {
  const [open, setOpen] = useState(false);
  const sample = sampleEventForTier(tier);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          {SAMPLE_BUTTON_LABEL}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{SAMPLE_BUTTON_LABEL}</DialogTitle>
          <DialogDescription>
            {tierLabel(tier)}
            {sample.fields.length > 0 ? `. ${SAMPLE_INTRO_LINE}` : ""}
          </DialogDescription>
        </DialogHeader>

        {sample.fields.length > 0 ? (
          <dl className="rounded-[var(--radius)] border border-border bg-secondary px-4 py-3 font-mono text-xs">
            {sample.fields.map((field) => (
              <div key={field.key} className="flex gap-2 py-1">
                <dt className="shrink-0 text-muted-foreground">{field.key}:</dt>
                <dd className="min-w-0 break-words text-foreground">{field.value}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="space-y-1.5">
          {sample.notes.map((note) => (
            <p key={note} className="text-sm text-muted-foreground">
              {note}
            </p>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

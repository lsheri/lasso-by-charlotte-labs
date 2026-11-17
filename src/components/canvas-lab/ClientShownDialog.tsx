import { useEffect, useState } from "react";

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
import {
  CLIENT_SHOWN_COPY,
  MAX_OCCASION_CHARS,
  shownDate,
  sortShowings,
  todayIso,
  validateShowing,
  type ClientShowing,
} from "@/lib/client-showings-shared";

/** Firm brain phase 1: record when a deliverable went in front of the client, and remove a mistaken mark. */
export function ClientShownDialog({
  open,
  onOpenChange,
  marks,
  onMark,
  onUnmark,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marks: ClientShowing[];
  onMark: (input: { shownOn: string; occasion: string }) => Promise<void>;
  onUnmark: (showing: ClientShowing) => Promise<void>;
}) {
  const today = todayIso();
  const [shownOn, setShownOn] = useState(today);
  const [occasion, setOccasion] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShownOn(todayIso());
    setOccasion("");
    setProblem(null);
  }, [open]);

  async function save() {
    const invalid = validateShowing({ shownOn, occasion }, today);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setBusy(true);
    try {
      await onMark({ shownOn, occasion });
      onOpenChange(false);
    } catch {
      setProblem(CLIENT_SHOWN_COPY.failed);
    } finally {
      setBusy(false);
    }
  }

  async function remove(showing: ClientShowing) {
    setBusy(true);
    try {
      await onUnmark(showing);
    } catch {
      setProblem(CLIENT_SHOWN_COPY.removeFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{CLIENT_SHOWN_COPY.title}</DialogTitle>
          <DialogDescription>{CLIENT_SHOWN_COPY.helper}</DialogDescription>
        </DialogHeader>
        {marks.length > 0 ? (
          <div className="space-y-1" data-testid="client-shown-earlier">
            <p className="text-sm font-medium">{CLIENT_SHOWN_COPY.earlier}</p>
            <ul className="space-y-1">
              {sortShowings(marks).map((showing) => (
                <li key={showing.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {shownDate(showing.shownOn)}
                    {showing.occasion ? `, ${showing.occasion}` : ""}
                  </span>
                  <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void remove(showing)}>
                    {CLIENT_SHOWN_COPY.remove}
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>{CLIENT_SHOWN_COPY.dateLabel}</span>
            <Input type="date" value={shownOn} max={today} onChange={(event) => setShownOn(event.target.value)} />
          </label>
          <label className="block space-y-1 text-sm">
            <span>{CLIENT_SHOWN_COPY.occasionLabel}</span>
            <Input
              value={occasion}
              maxLength={MAX_OCCASION_CHARS}
              placeholder={CLIENT_SHOWN_COPY.occasionPlaceholder}
              onChange={(event) => setOccasion(event.target.value)}
            />
          </label>
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              {CLIENT_SHOWN_COPY.cancel}
            </Button>
            <Button type="submit" disabled={busy}>
              {CLIENT_SHOWN_COPY.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  BOARD_OUTCOME_COPY,
  MAX_LESSON_CHARS,
  choiceFromOutcome,
  formatOutcome,
  validateOutcome,
  type OutcomeChoice,
} from "@/lib/board-outcome-shared";
import { saveOutcome } from "@/lib/save-guard";

/**
 * 18 Nov, firm brain: set how a finished engagement ended (its own file, since nothing renders CanvasLabPage in
 * tests). Writes engagements.outcome through the ordinary update, so the board's own policies decide who may.
 */
export function BoardOutcomeDialog({
  engagementId,
  open,
  onClose,
  onSaved,
}: {
  engagementId: string;
  open: boolean;
  onClose: () => void;
  onSaved?: ((outcome: string | null) => void) | undefined;
}) {
  const [choice, setChoice] = useState<OutcomeChoice>(choiceFromOutcome(null));
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // The fields stay locked until the saved line arrives, so a late load never overwrites a choice.
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setProblem(null);
    setChoice(choiceFromOutcome(null));
    setLoaded(false);
    let live = true;
    void supabase
      .from("engagements")
      .select("outcome")
      .eq("id", engagementId)
      .maybeSingle()
      .then(({ data }) => {
        if (!live) return;
        setChoice(choiceFromOutcome((data as { outcome: string | null } | null)?.outcome ?? null));
        setLoaded(true);
      }, () => {
        if (live) setProblem(BOARD_OUTCOME_COPY.loadFailed);
      });
    return () => {
      live = false;
    };
  }, [open, engagementId]);

  async function save() {
    const invalid = validateOutcome(choice);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setBusy(true);
    const outcome = formatOutcome(choice);
    const result = await supabase.from("engagements").update({ outcome }).eq("id", engagementId).select("id");
    setBusy(false);
    // Zero rows back means a policy refused the write: the dialog stays open with an honest line.
    if (!saveOutcome(result, BOARD_OUTCOME_COPY.failed).ok) {
      setProblem(BOARD_OUTCOME_COPY.failed);
      return;
    }
    onSaved?.(outcome);
    onClose();
  }

  const running = choice.plan === "running";
  const locked = !loaded || busy;
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md" data-testid="board-outcome">
        <DialogHeader>
          <DialogTitle>{BOARD_OUTCOME_COPY.title}</DialogTitle>
          <DialogDescription>{BOARD_OUTCOME_COPY.helper}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <label className="block space-y-1 text-sm">
            <span>{BOARD_OUTCOME_COPY.planLabel}</span>
            <NativeSelect disabled={locked} value={choice.plan} onChange={(event) => {
                const plan = event.target.value as OutcomeChoice["plan"];
                // Still running has no outcome: the extension and lesson go with it.
                setChoice(plan === "running" ? { plan, extended: "unknown", lesson: "" } : { ...choice, plan });
              }}>
              <option value="running">{BOARD_OUTCOME_COPY.running}</option>
              <option value="ran">{BOARD_OUTCOME_COPY.ranToPlan}</option>
              <option value="overran">{BOARD_OUTCOME_COPY.overran}</option>
            </NativeSelect>
          </label>
          <label className="block space-y-1 text-sm">
            <span>{BOARD_OUTCOME_COPY.extendedLabel}</span>
            <NativeSelect
              disabled={locked || running}
              value={choice.extended}
              onChange={(event) => setChoice({ ...choice, extended: event.target.value as OutcomeChoice["extended"] })}
            >
              <option value="unknown">{BOARD_OUTCOME_COPY.unknown}</option>
              <option value="yes">{BOARD_OUTCOME_COPY.extended}</option>
              <option value="no">{BOARD_OUTCOME_COPY.notExtended}</option>
            </NativeSelect>
          </label>
          <label className="block space-y-1 text-sm">
            <span>{BOARD_OUTCOME_COPY.lessonLabel}</span>
            <Textarea
              rows={2}
              maxLength={MAX_LESSON_CHARS}
              disabled={locked || running}
              placeholder={BOARD_OUTCOME_COPY.lessonPlaceholder}
              value={choice.lesson}
              onChange={(event) => setChoice({ ...choice, lesson: event.target.value })}
            />
          </label>
          {problem ? (
            <p role="alert" className="text-(length:--type-small) text-destructive">
              {problem}
            </p>
          ) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {BOARD_OUTCOME_COPY.cancel}
            </Button>
            <Button type="submit" disabled={locked}>
              {BOARD_OUTCOME_COPY.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

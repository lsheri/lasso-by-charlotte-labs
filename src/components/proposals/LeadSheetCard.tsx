import { useCallback, useRef, useState, type ComponentProps } from "react";

import { StepCard } from "@/components/ui/step-card";
import { SHEET_COPY } from "@/lib/lead-ask-shared";
import { STEP_CARD_COPY } from "@/lib/step-card-shared";

import { LeadSheet } from "./LeadSheet";

type SheetProps = ComponentProps<typeof LeadSheet>;

/**
 * 21 Nov 2026, click path cards: the lead sheet (pick the lead, then ask them) on a step card instead of a dialog, from
 * a row's "Pick a lead" or "Ask", or an admin's Home link. Every step, word and server call is the sheet's own; the
 * card shows "Step 1 of 2" while picking and "Step 2 of 2" on the ask, and holds still while the sheet saves.
 */
export function LeadSheetCard(props: Omit<SheetProps, "inline" | "onState">) {
  const [state, setState] = useState({ confirm: false, working: false });
  // The card plays its way out after the target is let go, so it keeps drawing the last one.
  const last = useRef(props.target);
  if (props.target) last.current = props.target;
  const target = props.target ?? last.current;
  const onState = useCallback((next: { confirm: boolean; working: boolean }) => setState(next), []);
  return (
    <StepCard
      open={props.target !== null}
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
      stepKey={target?.proposal.id ?? "lead"}
      marker={STEP_CARD_COPY.stepOf(state.confirm ? 2 : 1, 2)}
      title={target ? SHEET_COPY.title(target.proposal.clientName) : ""}
      hideTitle
      busy={state.working}
      testId="lead-sheet-card"
    >
      <LeadSheet {...props} target={target} inline onState={onState} />
    </StepCard>
  );
}

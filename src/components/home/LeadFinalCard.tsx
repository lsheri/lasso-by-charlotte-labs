import { useState } from "react";

import { LeadApprovalLine } from "@/components/home/LeadApprovalLine";
import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/ui/step-card";
import { FileText } from "@/design/brand/icons";
import { type ApprovalResult, type ApprovalView, type ProposalStage } from "@/lib/proposal-approval-shared";
import { deskDate } from "@/lib/proposal-desk-shared";
import { FINAL_COPY, FINAL_CARD_COPY, type FinalView } from "@/lib/proposal-final-shared";
import { STEP_CARD_COPY, stepDirection } from "@/lib/step-card-shared";

import { LeadFinalBlock, type FinalTools } from "./LeadFinalBlock";

import "@/components/proposals/proposal-flow.css";

/** Where the Lead's card opens: deciding the final, or sending it for approval. */
export type LeadCardStep = "final" | "approval";

/**
 * 21 Nov 2026, click path cards: the Lead's way to the final on Home, as one step card in two steps. Decide the final
 * proposal (the final block: upload it, draft it from the brief, or use a document that was sent), then Send for
 * approval (PR 303's own approval line, with its own call, on the card). The row keeps one line saying where things are.
 * Every press is the block's or the line's own, through the server's checks.
 */
export function LeadFinalCard({
  proposalId,
  client,
  final,
  documents,
  tools,
  approval,
  now,
}: {
  proposalId: string;
  client: string;
  final: FinalView | null | undefined;
  documents: readonly { id: string; title: string }[];
  tools: FinalTools;
  /** Phase 5 (PR 303): where the approval stands, and the send or take-back press. Left out, the card has one step. */
  approval?:
    | { stage: ProposalStage; view: ApprovalView | null | undefined; ask: (withdraw: boolean) => Promise<ApprovalResult> }
    | undefined;
  now?: Date | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<LeadCardStep>("final");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const C = FINAL_COPY;
  const A = FINAL_CARD_COPY;
  const chosen = Boolean(final && !final.gone);
  const stage = approval?.stage ?? null;
  const steps: LeadCardStep[] = approval ? ["final", "approval"] : ["final"];

  function openAt(at: LeadCardStep) {
    setDirection("forward");
    setStep(approval ? at : "final");
    setOpen(true);
  }
  function go(next: LeadCardStep) {
    setDirection(stepDirection(steps.indexOf(step), steps.indexOf(next)));
    setStep(next);
  }

  const where = final?.gone ? C.gone(deskDate(final.chosenAt, now)) : final ? C.chosen(final.title || "Untitled", deskDate(final.chosenAt, now)) : A.notYet;
  const sendNext = stage === "ready_to_send" || stage === "changes_asked";
  const marker = steps.length > 1 ? STEP_CARD_COPY.stepOf(steps.indexOf(step) + 1, steps.length) : null;

  return (
    <div data-led-final-row={final?.gone ? "gone" : final ? "chosen" : "none"} className="flex flex-col gap-2 text-(length:--type-small)">
      <p className="font-medium text-foreground">{C.heading}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]">{where}</p>
        {stage === "awaiting_approval" || stage === "client_review" || stage === "approved_not_sent" ? null : (
          <Button type="button" size="sm" variant={chosen ? "outline" : "default"} onClick={() => openAt("final")} data-led-final-open="">
            {chosen ? A.change : A.decide}
          </Button>
        )}
      </div>
      {/* PR 303's approval line, on the row: where it stands; its Send for approval opens the card on that step. */}
      {approval ? (
        <LeadApprovalLine stage={approval.stage} approval={approval.view} onAsk={approval.ask} onSend={sendNext ? () => openAt("approval") : undefined} />
      ) : null}
      <StepCard
        open={open}
        onOpenChange={setOpen}
        stepKey={step}
        direction={direction}
        marker={marker}
        title={step === "final" ? A.title : A.approvalTitle}
        intro={step === "final" ? (client ? A.intro(client) : null) : A.approvalIntro}
        onBack={step === "approval" ? () => go("final") : null}
        onReopen={() => setOpen(true)}
        testId="lead-final-card"
        footer={
          step === "final" && approval ? (
            <Button type="button" disabled={!chosen} onClick={() => go("approval")} data-flow-primary="">
              {A.next}
            </Button>
          ) : (
            // While the final still waits to be sent, PR 303's own Send for approval on the step is the one filled button.
            <Button type="button" variant={step === "final" || sendNext ? "ghost" : "default"} onClick={() => setOpen(false)}>
              {A.close}
            </Button>
          )
        }
      >
        {step === "final" ? (
          <LeadFinalBlock proposalId={proposalId} final={final} documents={documents} tools={tools} now={now} />
        ) : approval ? (
          <div className="flex flex-col gap-4">
            {final && !final.gone ? (
              <div className="flow-tile flow-tile--wide" data-led-approval-final="">
                <FileText aria-hidden className="size-5" />
                <span>{final.title || "Untitled"}</span>
              </div>
            ) : null}
            <LeadApprovalLine stage={approval.stage} approval={approval.view} onAsk={approval.ask} />
          </div>
        ) : null}
      </StepCard>
    </div>
  );
}

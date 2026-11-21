import { useState } from "react";

import { Button } from "@/components/ui/button";
import { APPROVAL_COPY, type ApprovalResult, type ApprovalView, type ProposalStage } from "@/lib/proposal-approval-shared";

/**
 * 21 Nov 2026, chat pill Phase 5 (D-97): where the Lead's proposal stands in the approval loop, and the one press it
 * needs next: Send for approval once a final is chosen (again after changes were asked), or Take it back while it
 * waits. An admin decides on Proposals. Nothing is texted until texts are approved.
 */
export function LeadApprovalLine({
  stage,
  approval,
  onAsk,
  onSend,
}: {
  stage: ProposalStage;
  approval: ApprovalView | null | undefined;
  onAsk: (withdraw: boolean) => Promise<ApprovalResult>;
  /** 21 Nov 2026, click path cards: on Home's row, Send for approval opens the Lead's step card on that step instead. */
  onSend?: (() => void) | undefined;
}) {
  const C = APPROVAL_COPY;
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function press(withdraw: boolean) {
    if (working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await onAsk(withdraw);
      if (!result.ok) setProblem(result.problem);
    } catch {
      setProblem(C.failed);
    } finally {
      setWorking(false);
    }
  }
  const line =
    stage === "awaiting_approval"
      ? C.waitingLead
      : stage === "changes_asked"
        ? C.changesAsked(approval?.decidedBy ?? "", approval?.note ?? null)
        : stage === "client_review"
          ? C.approvedLead
          : stage === "final_needed"
            ? C.needsFinal
            : null;
  return (
    <div data-led-stage={stage} className="flex flex-col gap-1 text-(length:--type-small)">
      <p className="font-medium text-foreground">{C.stage[stage]}</p>
      {line ? <p className="break-words text-muted-foreground [overflow-wrap:anywhere]">{line}</p> : null}
      {stage === "ready_to_send" || stage === "changes_asked" ? (
        <Button type="button" size="sm" className="self-start" disabled={working} onClick={() => (onSend ? onSend() : void press(false))}>
          {working ? C.sending : C.send}
        </Button>
      ) : null}
      {stage === "awaiting_approval" ? (
        <button type="button" className="self-start text-muted-foreground underline hover:text-foreground disabled:opacity-50" disabled={working} onClick={() => void press(true)}>
          {C.withdraw}
        </button>
      ) : null}
      {problem ? (
        <p role="alert" className="text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

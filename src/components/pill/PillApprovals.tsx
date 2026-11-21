import { APPROVAL_COPY } from "@/lib/proposal-approval-shared";
import type { DeskList } from "@/lib/proposal-desk-shared";

export const PILL_APPROVAL_COPY = {
  one: (lead: string, client: string) => `${lead || "A lead"} sent ${client || "a proposal"} for approval.`,
  more: (count: number) => `${count} proposals wait for your approval.`,
  open: "Review on Proposals",
} as const;

/**
 * 21 Nov 2026, chat pill Phase 5 (D-97): an admin's pill says when a Lead sent a final for approval, with one press
 * to its row on Proposals. Nothing for anyone else, or when nothing waits.
 */
export function PillApprovals({ desk, onOpen }: { desk: DeskList | undefined; onOpen: (proposalId: string) => void }) {
  if (!desk?.canSetGoal) return null;
  const waiting = desk.proposals.filter((proposal) => proposal.status === "open" && proposal.approval?.state === "waiting");
  const first = waiting[0];
  if (!first) return null;
  return (
    <div className="chat-pill__msg" data-pill-approvals={waiting.length}>
      <p>
        {waiting.length === 1
          ? PILL_APPROVAL_COPY.one(first.approval?.requestedBy || first.leadName || "", first.clientName)
          : PILL_APPROVAL_COPY.more(waiting.length)}{" "}
        {first.approval?.stale ? APPROVAL_COPY.stale(first.approval.requestedBy) : ""}
      </p>
      <div className="chat-pill__acts">
        <button type="button" className="chat-pill__act" onClick={() => onOpen(first.id)}>
          {PILL_APPROVAL_COPY.open}
        </button>
      </div>
    </div>
  );
}

import { dueLabel } from "@/lib/pill-proposal-shared";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AskLine } from "@/components/proposals/AskLead";
import { LeadChip } from "@/components/proposals/LeadChip";
import { isAtGoal, ProposalClock } from "@/components/proposals/ProposalClock";
import { ProposalMore, type MoreAction } from "@/components/proposals/ProposalMore";
import { SendDocsLine } from "@/components/proposals/SendDocsLine";
import { ApprovalReview } from "@/components/proposals/ApprovalReview";
import { APPROVAL_COPY, type ApprovalResult } from "@/lib/proposal-approval-shared";
import { Button } from "@/components/ui/button";
import { tagVariants } from "@/components/ui/tag";
import type { PracticeReplyResult, Reply } from "@/lib/lead-ask-shared";
import type { SendDocsResult } from "@/lib/lead-view-shared";
import {
  askWord,
  CLOSE_COPY,
  DESK_COPY,
  deskDate,
  nextStep,
  SENT_COPY,
  SPACE_COPY,
  timeLeft,
  WIN_COPY,
  type DeskProposal,
  type SentResult,
} from "@/lib/proposal-desk-shared";
import type { RosterContact } from "@/lib/roster-shared";
import { cn } from "@/lib/utils";

export { clockShare, isAtGoal } from "@/components/proposals/ProposalClock";

/**
 * 20 Nov 2026 (Liam, D-86, "the mix it starts on"): one proposal, read in one pass. Who it is for in bold with what
 * they asked for beneath; the lead as a chip; the clock as a bar with its goal mark and one line; the next step as a
 * button, filled only on the proposal that is Up next, so the page has one. Undo sent, Close as lost and Archive keep
 * their names under More. Every control the row had is still here.
 */
export function ProposalRow({
  proposal,
  goalHours,
  now,
  onSent,
  onWin,
  lead,
  ask,
  onClose,
  featured = false,
  onSendDocs,
  review,
}: {
  proposal: DeskProposal;
  goalHours: number;
  now?: Date | undefined;
  onSent?: ((proposalId: string, sent: boolean) => Promise<SentResult>) | undefined;
  onWin?: (() => void) | undefined;
  lead?: { person: RosterContact | undefined; onPick: () => void } | undefined;
  ask?:
    | {
        onAsk: () => void;
        onPracticeReply: (reply: Reply) => Promise<PracticeReplyResult>;
        /** A real workspace whose texts have not started: record the lead's answer heard another way. */
        onRecordAnswer?: ((reply: "yes" | "no") => Promise<PracticeReplyResult>) | undefined;
      }
    | undefined;
  onClose?: ((change: "lost" | "archived") => void) | undefined;
  /** Up next: the one proposal on the page whose next step is the filled button. */
  featured?: boolean | undefined;
  /** 21 Nov 2026, PR 4b: the person who started it sends the documents to the lead, or stops sharing them. */
  onSendDocs?: ((send: boolean) => Promise<SendDocsResult>) | undefined;
  /** Phase 5: an admin decides the Lead's request. Left out, a waiting request is only named. */
  review?:
    | {
        decide: (approvalId: string, decision: "approved" | "changes_asked", note: string | null) => Promise<ApprovalResult>;
        readFinal: () => Promise<{ ok: true; title: string; text: string } | { ok: false; problem: string }>;
      }
    | undefined;
}) {
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function press(sent: boolean) {
    if (!onSent || working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await onSent(proposal.id, sent);
      if (!result.ok) setProblem(result.problem);
    } catch {
      setProblem(SENT_COPY.failed);
    } finally {
      setWorking(false);
    }
  }

  const titleBlock = (
    <p data-proposal-title className="break-words [overflow-wrap:anywhere]">
      {proposal.clientName ? (
        <span className={cn("block font-semibold text-foreground", featured ? "text-(length:--type-title)" : "text-(length:--type-lead)")}>
          {proposal.clientName}
          <span className="sr-only">: </span>
        </span>
      ) : null}
      <span
        className={cn(
          "block",
          proposal.clientName ? "text-(length:--type-control) text-muted-foreground" : "text-(length:--type-lead) font-semibold text-foreground",
        )}
      >
        {proposal.title}
      </span>
    </p>
  );

  if (proposal.status !== "open") {
    return (
      <li
        data-proposal-row={proposal.id}
        className={cn(
          "flex flex-col gap-2 rounded-[var(--radius-card)] border border-border px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
          proposal.status === "won" ? "bg-[var(--good-wash)]" : "bg-card",
        )}
      >
        <div className="min-w-0">
          {titleBlock}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {proposal.mine ? (
              <span className={tagVariants({ tone: "accent" })}>{DESK_COPY.yours}</span>
            ) : proposal.ownerName ? (
              <span data-proposal-owner className="min-w-0 max-w-full [overflow-wrap:anywhere]">{DESK_COPY.owner(proposal.ownerName)}</span>
            ) : null}
            {/* "No documents yet" is a prompt to add one, so a decided proposal with none says nothing. */}
            {proposal.dueOn && dueLabel(proposal.dueOn) ? <span data-proposal-due>{DESK_COPY.due(dueLabel(proposal.dueOn))}</span> : null}
            {proposal.contextCount > 0 ? <span data-proposal-context>{DESK_COPY.context(proposal.contextCount)}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm sm:justify-end">
          {proposal.status === "won" ? (
            <span data-proposal-won className="inline-block rounded-full bg-[var(--good-tint)] px-2 py-0.5 text-foreground">
              {DESK_COPY.wonOn(deskDate(proposal.decidedAt, now))}
            </span>
          ) : (
            <span className="text-foreground">{DESK_COPY.lostOn(deskDate(proposal.decidedAt, now))}</span>
          )}
          {/* The board is the owner's; nobody else is on it until they are added there. */}
          {proposal.engagementId && proposal.mine ? (
            <Link to="/engagements/$id/canvas-lab" params={{ id: proposal.engagementId }} className="underline">
              {DESK_COPY.openBoard}
            </Link>
          ) : null}
          {onClose && proposal.canArchive ? (
            <button type="button" className="text-muted-foreground underline hover:text-foreground" onClick={() => onClose("archived")}>
              {CLOSE_COPY.archive}
            </button>
          ) : null}
        </div>
      </li>
    );
  }

  const left = timeLeft({ receivedAt: proposal.receivedAt, sentAt: proposal.sentAt, goalHours, now });
  const titles = proposal.contextTitles ?? [];
  const maySend = Boolean(onSent && proposal.canAct);
  const mayWin = Boolean(onWin && proposal.mine);
  const step = nextStep(proposal, { send: Boolean(onSent), win: Boolean(onWin) });
  const undo = maySend && Boolean(proposal.sentAt);
  const atGoal = !proposal.sentAt && left.state === "running" && isAtGoal(proposal.receivedAt, goalHours, now);
  const more: MoreAction[] = [];
  // Taking "sent" back sits with the other quiet changes, away from the line that says it went out.
  if (undo) more.push({ id: "undo", label: working ? SENT_COPY.working : SENT_COPY.undo, disabled: working, onSelect: () => void press(false) });
  // One thing at a time (D-86): until it has gone out, sending is the step; Record the win waits under More, by name.
  const winInMore = mayWin && maySend && !proposal.sentAt;
  if (winInMore && onWin) more.push({ id: "win", label: WIN_COPY.record, onSelect: onWin });
  if (onClose && proposal.canClose) more.push({ id: "lost", label: CLOSE_COPY.lost, onSelect: () => onClose("lost") });
  if (onClose && proposal.canArchive) more.push({ id: "archive", label: CLOSE_COPY.archive, onSelect: () => onClose("archived") });
  const word = askWord(proposal.ask);
  // Admins and leads read the name from the roster; the person who started it is sent the name alone.
  const leadName = lead ? lead.person?.name : (proposal.leadName ?? undefined);

  return (
    <li
      data-proposal-row={proposal.id}
      data-up-next={featured ? "" : undefined}
      className={cn(
        "rounded-[var(--radius-card)] border border-border bg-card",
        featured ? "p-4 shadow-card sm:p-6" : "px-4 py-3.5",
      )}
    >
      {featured ? <p data-up-next-label className="mb-1 text-(length:--type-small) font-semibold text-muted-foreground">{SPACE_COPY.upNext}</p> : null}
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,13rem)_auto] md:items-center md:gap-5">
        <div className="min-w-0">
          {titleBlock}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            {proposal.mine ? (
              <span className={tagVariants({ tone: "accent" })}>{DESK_COPY.yours}</span>
            ) : proposal.ownerName ? (
              <span data-proposal-owner className="min-w-0 max-w-full [overflow-wrap:anywhere]">{DESK_COPY.owner(proposal.ownerName)}</span>
            ) : null}
            {proposal.dueOn && dueLabel(proposal.dueOn) ? <span data-proposal-due>{DESK_COPY.due(dueLabel(proposal.dueOn))}</span> : null}
            <span data-proposal-context>{DESK_COPY.context(proposal.contextCount)}</span>
          </p>
          {/* D-86, one thing at a time: the titles open on Up next, and when the lead's yes lands (the row opens to
              show what they will work from). Otherwise the count above says enough. */}
          {titles.length > 0 && (featured || word === "yes") ? (
            <ul
              key={word === "yes" ? "yes" : "titles"}
              className="mt-1.5 flex flex-wrap gap-1.5 text-(length:--type-small) text-foreground animate-in fade-in-0 slide-in-from-top-1 duration-500 motion-reduce:animate-none"
              data-proposal-context-titles
            >
              {titles.map((title, index) => (
                <li key={`${index}-${title}`} className="max-w-full break-words rounded-[var(--radius-control)] border border-border bg-background px-2 py-0.5 [overflow-wrap:anywhere]">
                  {title}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          {/* Admins and leads pick; the person who started it sees who the lead is, without the roster or the pick. */}
          <LeadChip name={leadName} texts={lead?.person?.texts} ask={word} picked={Boolean(proposal.leadContactId)} onPick={lead?.onPick} />
          {/* The line beneath the chip says the ask in full. When the answer changes it fades in fresh. */}
          <div key={proposal.ask ? `${proposal.ask.status}-${proposal.ask.reply ?? ""}` : "none"} className="animate-in fade-in-0 duration-500 motion-reduce:animate-none">
            <AskLine proposal={proposal} canAsk={Boolean(ask && proposal.leadContactId)} onAsk={() => ask?.onAsk()} onPracticeReply={ask?.onPracticeReply} onRecordAnswer={ask?.onRecordAnswer} />
          </div>
          {proposal.approval?.state === "waiting" && review ? (
            <ApprovalReview
              approval={proposal.approval}
              leadName={leadName ?? ""}
              proposalId={proposal.id}
              decide={(decision, note) => review.decide(proposal.approval!.id, decision, note)}
              readFinal={review.readFinal}
            />
          ) : proposal.approval?.state === "waiting" ? (
            <p data-approval-waiting className="text-(length:--type-small) text-muted-foreground">{APPROVAL_COPY.stage.awaiting_approval}</p>
          ) : proposal.approval?.state === "approved" && proposal.sentAt ? (
            <p data-approval-client className="text-(length:--type-small) text-foreground">{APPROVAL_COPY.stage.client_review}</p>
          ) : null}
          {proposal.mine && proposal.leadDocs && onSendDocs ? (
            <SendDocsLine state={proposal.leadDocs} leadName={leadName ?? ""} hasDocs={proposal.contextCount > 0} added={proposal.leadDocsAdded} onSend={onSendDocs} />
          ) : null}
        </div>
        <ProposalClock left={left} goalHours={goalHours} atGoal={atGoal} large={featured} />
        <div className="flex flex-wrap items-center gap-2 md:justify-end">
          {maySend && !proposal.sentAt ? (
            <Button type="button" size="sm" variant={featured && step === "send" ? "default" : "outline"} disabled={working} onClick={() => void press(true)}>
              {working ? SENT_COPY.working : SENT_COPY.mark}
            </Button>
          ) : null}
          {mayWin && !winInMore ? (
            <Button type="button" size="sm" variant={featured && step === "win" ? "default" : "outline"} onClick={onWin}>
              {WIN_COPY.record}
            </Button>
          ) : null}
          <ProposalMore label={SPACE_COPY.moreLabel(proposal.clientName, proposal.title)} actions={more} />
        </div>
      </div>
      {problem ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </li>
  );
}

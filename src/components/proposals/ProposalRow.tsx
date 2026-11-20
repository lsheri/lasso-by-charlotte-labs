import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AskLine } from "@/components/proposals/AskLead";
import { LeadLine } from "@/components/proposals/LeadPicker";
import { Button } from "@/components/ui/button";
import { tagVariants } from "@/components/ui/tag";
import type { PracticeReplyResult, Reply } from "@/lib/lead-ask-shared";
import {
  CLOSE_COPY,
  DESK_COPY,
  deskDate,
  LEAD_COPY,
  SENT_COPY,
  timeLeft,
  timeLeftLine,
  WIN_COPY,
  type DeskProposal,
  type SentResult,
  type TimeLeft,
} from "@/lib/proposal-desk-shared";
import type { RosterContact } from "@/lib/roster-shared";
import { cn } from "@/lib/utils";

/** How much of the goal is used, 0 to 1. A proposal that has gone out, or run over, fills the bar. */
export function clockShare(left: TimeLeft, goalHours: number): number {
  if (left.state !== "running" || goalHours <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - left.hoursLeft / goalHours));
}

/**
 * 20 Nov 2026 (design review): one proposal, read in one pass. Who it is for in bold with what they asked for
 * beneath, the clock as a bar with its one line, and one filled button for the next step; everything else is quiet.
 * Every control the row had is still here under the same name.
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
}: {
  proposal: DeskProposal;
  goalHours: number;
  now?: Date | undefined;
  onSent?: ((proposalId: string, sent: boolean) => Promise<SentResult>) | undefined;
  onWin?: (() => void) | undefined;
  lead?: { person: RosterContact | undefined; onPick: () => void } | undefined;
  ask?:
    | { onAsk: () => void; onPracticeReply: (reply: Reply) => Promise<PracticeReplyResult> }
    | undefined;
  onClose?: ((change: "lost" | "archived") => void) | undefined;
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
  const left = timeLeft({
    receivedAt: proposal.receivedAt,
    sentAt: proposal.sentAt,
    goalHours,
    now,
  });
  const titles = proposal.contextTitles ?? [];
  const maySend = Boolean(onSent && proposal.canAct);
  const mayWin = Boolean(onWin && proposal.mine);
  // One filled button: sending it comes first, then recording the win.
  const next = maySend && !proposal.sentAt ? "send" : mayWin ? "win" : null;
  const good = left.state === "sent" && left.withinGoal;
  return (
    <li
      data-proposal-row={proposal.id}
      className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
    >
      <div className="min-w-0">
        <p data-proposal-title className="break-words [overflow-wrap:anywhere]">
          {proposal.clientName ? (
            <span className="block text-(length:--type-lead) font-semibold text-foreground">
              {proposal.clientName}
              <span className="sr-only">: </span>
            </span>
          ) : null}
          <span
            className={cn(
              "block",
              proposal.clientName
                ? "text-(length:--type-control) text-muted-foreground"
                : "text-(length:--type-lead) font-semibold text-foreground",
            )}
          >
            {proposal.title}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {proposal.mine ? (
            <span className={tagVariants({ tone: "accent" })}>{DESK_COPY.yours}</span>
          ) : proposal.ownerName ? (
            <span>{DESK_COPY.owner(proposal.ownerName)}</span>
          ) : null}
          {/* "No documents yet" is a prompt to add one, so a decided proposal with none says nothing. */}
          {proposal.status === "open" || proposal.contextCount > 0 ? (
            <span data-proposal-context>{DESK_COPY.context(proposal.contextCount)}</span>
          ) : null}
        </p>
        {lead && proposal.status === "open" ? (
          <LeadLine
            lead={lead.person}
            picked={Boolean(proposal.leadContactId)}
            onPick={lead.onPick}
          />
        ) : null}
        {/* The person who started it sees who the lead is, without the roster or the pick. */}
        {!lead && proposal.status === "open" && proposal.leadName ? (
          <p
            data-proposal-lead
            className="mt-1 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]"
          >
            {LEAD_COPY.lead(proposal.leadName)}
          </p>
        ) : null}
        {proposal.status === "open" ? (
          <AskLine
            proposal={proposal}
            canAsk={Boolean(ask && proposal.leadContactId)}
            onAsk={() => ask?.onAsk()}
            onPracticeReply={ask?.onPracticeReply}
          />
        ) : null}
        {titles.length > 0 ? (
          <ul className="mt-1 text-sm text-muted-foreground" data-proposal-context-titles>
            {titles.map((title, index) => (
              <li key={`${index}-${title}`} className="break-words [overflow-wrap:anywhere]">
                {title}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="shrink-0 text-sm sm:w-56 sm:text-right">
        {proposal.status === "open" ? (
          <>
            <div
              aria-hidden="true"
              data-proposal-clock-bar
              className={cn(
                "h-1.5 overflow-hidden rounded-full",
                good ? "bg-[var(--good-tint)]" : "bg-[var(--action-wash)]",
              )}
            >
              <div
                className={cn(
                  "h-full rounded-full",
                  left.state === "over"
                    ? "bg-destructive"
                    : good
                      ? "bg-[var(--good-mark)]"
                      : "bg-[var(--action-fill)]",
                )}
                style={{ width: `${Math.round(clockShare(left, goalHours) * 100)}%` }}
              />
            </div>
            <p
              data-proposal-clock={left.state}
              className={cn("mt-1", left.state === "over" ? "text-destructive" : "text-foreground")}
            >
              {timeLeftLine(left, goalHours)}
            </p>
            {problem ? (
              <p role="alert" className="mt-1 text-destructive">
                {problem}
              </p>
            ) : null}
            {maySend || mayWin ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 sm:justify-end">
                {maySend ? (
                  proposal.sentAt ? (
                    <button
                      type="button"
                      className="text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                      disabled={working}
                      onClick={() => void press(false)}
                    >
                      {working ? SENT_COPY.working : SENT_COPY.undo}
                    </button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant={next === "send" ? "default" : "outline"}
                      disabled={working}
                      onClick={() => void press(true)}
                    >
                      {working ? SENT_COPY.working : SENT_COPY.mark}
                    </Button>
                  )
                ) : null}
                {mayWin ? (
                  <Button
                    type="button"
                    size="sm"
                    variant={next === "win" ? "default" : "outline"}
                    onClick={onWin}
                  >
                    {WIN_COPY.record}
                  </Button>
                ) : null}
              </div>
            ) : null}
            {onClose && (proposal.canClose || proposal.canArchive) ? (
              <p
                data-proposal-close
                className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-muted-foreground sm:justify-end"
              >
                {proposal.canClose ? (
                  <button
                    type="button"
                    className="underline hover:text-foreground"
                    onClick={() => onClose("lost")}
                  >
                    {CLOSE_COPY.lost}
                  </button>
                ) : null}
                {proposal.canArchive ? (
                  <button
                    type="button"
                    className="underline hover:text-foreground"
                    onClick={() => onClose("archived")}
                  >
                    {CLOSE_COPY.archive}
                  </button>
                ) : null}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-foreground">
              {proposal.status === "won" ? (
                <span
                  data-proposal-won
                  className="inline-block rounded-full bg-[var(--good-tint)] px-2 py-0.5"
                >
                  {DESK_COPY.wonOn(deskDate(proposal.decidedAt, now))}
                </span>
              ) : (
                DESK_COPY.lostOn(deskDate(proposal.decidedAt, now))
              )}
            </p>
            {/* The board is the owner's; nobody else is on it until they are added there. */}
            {onClose && proposal.canArchive ? (
              <p className="mt-1">
                <button
                  type="button"
                  className="text-muted-foreground underline hover:text-foreground"
                  onClick={() => onClose("archived")}
                >
                  {CLOSE_COPY.archive}
                </button>
              </p>
            ) : null}
            {proposal.engagementId && proposal.mine ? (
              <Link
                to="/engagements/$id/canvas-lab"
                params={{ id: proposal.engagementId }}
                className="mt-1 inline-block underline"
              >
                {DESK_COPY.openBoard}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { chipVariants } from "@/components/ui/chip";
import { tagVariants } from "@/components/ui/tag";
import {
  SENT_COPY,
  DESK_COPY,
  DESK_VIEWS,
  deskCounts,
  deskDate,
  deskView,
  timeLeft,
  timeLeftLine,
  type DeskList,
  type DeskProposal,
  type DeskView,
  type SentResult,
} from "@/lib/proposal-desk-shared";
import { cn } from "@/lib/utils";

/**
 * 20 Nov 2026, the Proposal Desk's dashboard: three views (All open, Needs me, Won) over the proposals this person
 * may see. One row per proposal: who it is for, what they asked for, how long it has left against the workspace's
 * own goal, and its context documents. Nothing here rates or ranks a person; a row names only who started it.
 */
export function ProposalDesk({
  data,
  now,
  onSent,
}: {
  data: DeskList;
  now?: Date | undefined;
  /** Marks a proposal as gone out, or takes that back. Left out, the rows are read only. */
  onSent?: ((proposalId: string, sent: boolean) => Promise<SentResult>) | undefined;
}) {
  const [view, setView] = useState<DeskView>("open");
  const counts = deskCounts(data.proposals);
  const rows = deskView(data.proposals, view);

  return (
    <section aria-label={DESK_COPY.title} data-testid="proposal-desk">
      <div role="group" aria-label="Show" className="mb-4 flex flex-wrap gap-2">
        {DESK_VIEWS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={view === id}
            data-desk-view={id}
            className={chipVariants({ tone: view === id ? "accent" : "quiet" })}
            onClick={() => setView(id)}
          >
            {DESK_COPY.views[id]} {counts[id]}
          </button>
        ))}
      </div>

      {view !== "won" && rows.length > 0 ? (
        <p data-desk-no-board className="mb-3 text-sm text-muted-foreground">
          {DESK_COPY.noBoardYet}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p data-desk-empty className="text-sm text-muted-foreground">
          {DESK_COPY.empty[view]}
        </p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map((proposal) => (
            <ProposalRow key={proposal.id} proposal={proposal} goalHours={data.goalHours} now={now} onSent={onSent} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ProposalRow({
  proposal,
  goalHours,
  now,
  onSent,
}: {
  proposal: DeskProposal;
  goalHours: number;
  now?: Date | undefined;
  onSent?: ((proposalId: string, sent: boolean) => Promise<SentResult>) | undefined;
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
  const left = timeLeft({ receivedAt: proposal.receivedAt, sentAt: proposal.sentAt, goalHours, now });
  const titles = proposal.contextTitles ?? [];
  return (
    <li data-proposal-row={proposal.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <p className="text-(length:--type-body) font-medium text-foreground">
          {proposal.clientName ? <span>{proposal.clientName}: </span> : null}
          {proposal.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {proposal.mine ? <span className={tagVariants({ tone: "accent" })}>{DESK_COPY.yours}</span> : proposal.ownerName ? <span>{DESK_COPY.owner(proposal.ownerName)}</span> : null}
          <span data-proposal-context>{DESK_COPY.context(proposal.contextCount)}</span>
        </p>
        {titles.length > 0 ? (
          <ul className="mt-1 text-sm text-muted-foreground" data-proposal-context-titles>
            {titles.map((title, index) => (
              <li key={`${index}-${title}`} className="truncate">
                {title}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="shrink-0 text-sm sm:text-right">
        {proposal.status === "open" ? (
          <>
            <p data-proposal-clock={left.state} className={cn(left.state === "over" ? "text-destructive" : "text-foreground")}>
              {timeLeftLine(left, goalHours)}
            </p>
            {onSent && proposal.canAct ? (
              <button
                type="button"
                className="mt-1 text-muted-foreground underline hover:text-foreground disabled:opacity-50"
                disabled={working}
                onClick={() => void press(!proposal.sentAt)}
              >
                {working ? SENT_COPY.working : proposal.sentAt ? SENT_COPY.undo : SENT_COPY.mark}
              </button>
            ) : null}
            {problem ? (
              <p role="alert" className="mt-1 text-destructive">
                {problem}
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-foreground">{proposal.status === "won" ? DESK_COPY.wonOn(deskDate(proposal.decidedAt)) : DESK_COPY.lostOn(deskDate(proposal.decidedAt))}</p>
            {proposal.engagementId ? (
              <Link to="/engagements/$id/canvas-lab" params={{ id: proposal.engagementId }} className="mt-1 inline-block underline">
                {DESK_COPY.openBoard}
              </Link>
            ) : null}
          </>
        )}
      </div>
    </li>
  );
}

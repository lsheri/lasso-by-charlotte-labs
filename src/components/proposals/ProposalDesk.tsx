import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  WIN_COPY,
  type DeskList,
  type DeskProposal,
  type DeskView,
  type SentResult,
  type WinResult,
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
  onWin,
}: {
  data: DeskList;
  now?: Date | undefined;
  /** Marks a proposal as gone out, or takes that back. Left out, the rows are read only. */
  onSent?: ((proposalId: string, sent: boolean) => Promise<SentResult>) | undefined;
  /** Records the win, which makes the team board. Offered only on the person's own open proposals. */
  onWin?: ((proposalId: string) => Promise<WinResult>) | undefined;
}) {
  const [view, setView] = useState<DeskView>("open");
  const [winning, setWinning] = useState<DeskProposal | null>(null);
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
            <ProposalRow key={proposal.id} proposal={proposal} goalHours={data.goalHours} now={now} onSent={onSent} onWin={onWin ? () => setWinning(proposal) : undefined} />
          ))}
        </ul>
      )}
      {onWin ? <WinDialog proposal={winning} onClose={() => setWinning(null)} onWin={onWin} /> : null}
    </section>
  );
}

/** Says what recording the win does before it happens, then does it once. */
function WinDialog({ proposal, onClose, onWin }: { proposal: DeskProposal | null; onClose: () => void; onWin: (proposalId: string) => Promise<WinResult> }) {
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function confirm() {
    if (!proposal || working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await onWin(proposal.id);
      if (result.ok) onClose();
      else setProblem(result.problem);
    } catch {
      setProblem(WIN_COPY.failed);
    } finally {
      setWorking(false);
    }
  }
  return (
    <Dialog
      open={proposal !== null}
      onOpenChange={(next) => {
        if (next || working) return;
        setProblem(null);
        onClose();
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="win-proposal">
        <DialogHeader>
          <DialogTitle className="page-title">{WIN_COPY.title}</DialogTitle>
          <DialogDescription>{proposal ? `${proposal.clientName ? `${proposal.clientName}: ` : ""}${proposal.title}` : ""}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-foreground">{WIN_COPY.body(proposal?.contextCount ?? 0)}</p>
        <p className="text-sm text-muted-foreground">{WIN_COPY.sharing}</p>
        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={working} onClick={onClose}>
            {WIN_COPY.cancel}
          </Button>
          <Button type="button" disabled={working} onClick={() => void confirm()}>
            {working ? WIN_COPY.working : WIN_COPY.confirm}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProposalRow({
  proposal,
  goalHours,
  now,
  onSent,
  onWin,
}: {
  proposal: DeskProposal;
  goalHours: number;
  now?: Date | undefined;
  onSent?: ((proposalId: string, sent: boolean) => Promise<SentResult>) | undefined;
  onWin?: (() => void) | undefined;
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
            {onWin && proposal.mine ? (
              <div className="mt-2">
                <Button type="button" variant="outline" size="sm" onClick={onWin}>
                  {WIN_COPY.record}
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-foreground">{proposal.status === "won" ? DESK_COPY.wonOn(deskDate(proposal.decidedAt)) : DESK_COPY.lostOn(deskDate(proposal.decidedAt))}</p>
            {/* The board is the owner's; nobody else is on it until they are added there. */}
            {proposal.engagementId && proposal.mine ? (
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

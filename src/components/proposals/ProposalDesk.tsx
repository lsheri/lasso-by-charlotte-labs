import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { AskDialog } from "@/components/proposals/AskLead";
import { LeadDialog } from "@/components/proposals/LeadPicker";
import { ProposalRow } from "@/components/proposals/ProposalRow";
import { Button } from "@/components/ui/button";
import { chipVariants } from "@/components/ui/chip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tagVariants } from "@/components/ui/tag";
import type { AskPreview, AskResult, PracticeReplyResult, Reply } from "@/lib/lead-ask-shared";
import {
  CLOSE_COPY,
  LEAD_COPY,
  type CloseResult,
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
  type LeadResult,
  type SentResult,
  type WinResult,
} from "@/lib/proposal-desk-shared";
import { HOME_PROPOSALS_COPY } from "@/lib/role-screens-shared";
import type { RosterContact } from "@/lib/roster-shared";
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
  roster,
  leadWords,
  onLead,
  ask,
  onClose,
  limit,
  initialView,
}: {
  data: DeskList;
  now?: Date | undefined;
  /** Home shows only the first few rows of a view, then a link to the Proposals page for the rest. */
  limit?: number | undefined;
  /** The view to open on, when a link from Home carried one. */
  initialView?: DeskView | undefined;
  /** Marks a proposal as gone out, or takes that back. Left out, the rows are read only. */
  onSent?: ((proposalId: string, sent: boolean) => Promise<SentResult>) | undefined;
  /** Records the win, which makes the team board. Offered only on the person's own open proposals. */
  onWin?: ((proposalId: string) => Promise<WinResult>) | undefined;
  /** People we work with, for naming and picking a lead. Used only when the server says this person may pick. */
  roster?: RosterContact[] | undefined;
  /** The won text as it is sent, shown when picking a lead. */
  leadWords?: string | undefined;
  onLead?: ((proposalId: string, contactId: string | null) => Promise<LeadResult>) | undefined;
  /** Asking the lead by text: the words before a press, the press, and a practice answer. Admins and leads only. */
  ask?:
    | {
        preview: (proposalId: string) => Promise<AskPreview>;
        send: (proposalId: string, pressId: string) => Promise<AskResult>;
        practiceReply: (proposalId: string, reply: Reply) => Promise<PracticeReplyResult>;
      }
    | undefined;
  /** Closes an open proposal as lost, or archives one made by mistake. */
  onClose?: ((proposalId: string, change: "lost" | "archived") => Promise<CloseResult>) | undefined;
}) {
  const [asking, setAsking] = useState<DeskProposal | null>(null);
  const [closing, setClosing] = useState<{ proposal: DeskProposal; change: "lost" | "archived" } | null>(null);
  const [leading, setLeading] = useState<DeskProposal | null>(null);
  const picks = Boolean(data.canPickLead && onLead);
  const [view, setView] = useState<DeskView>(initialView ?? "open");
  const [winning, setWinning] = useState<DeskProposal | null>(null);
  const counts = deskCounts(data.proposals);
  const all = deskView(data.proposals, view);
  const rows = limit ? all.slice(0, limit) : all;

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

      {(view === "open" || view === "mine") && rows.length > 0 ? (
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
            <ProposalRow key={proposal.id} proposal={proposal} goalHours={data.goalHours} now={now} onSent={onSent} onWin={onWin ? () => setWinning(proposal) : undefined}
              lead={picks ? { person: roster?.find((person) => person.id === proposal.leadContactId), onPick: () => setLeading(proposal) } : undefined}
              ask={picks && ask ? { onAsk: () => setAsking(proposal), onPracticeReply: (reply) => ask.practiceReply(proposal.id, reply) } : undefined}
              onClose={onClose ? (change) => setClosing({ proposal, change }) : undefined}
            />
          ))}
        </ul>
      )}
      {all.length > rows.length ? (
        <p data-desk-more className="mt-3 text-sm">
          <Link to="/proposals" search={view === "open" ? {} : { view }} className="text-muted-foreground underline hover:text-foreground">
            {HOME_PROPOSALS_COPY.seeAll(all.length)}
          </Link>
        </p>
      ) : null}
      {onWin ? <WinDialog proposal={winning} onClose={() => setWinning(null)} onWin={onWin} /> : null}
      {picks && onLead ? <LeadDialog proposal={leading} roster={roster} words={leadWords ?? ""} demo={data.texts.demo} onClose={() => setLeading(null)} onSave={onLead} /> : null}
      {picks && ask ? <AskDialog proposal={asking} load={ask.preview} send={ask.send} onClose={() => setAsking(null)} /> : null}
      {onClose ? <CloseDialog target={closing} onDone={() => setClosing(null)} onClose={onClose} /> : null}
    </section>
  );
}

/** Says what closing or archiving does before it happens, then does it once. */
function CloseDialog({
  target,
  onDone,
  onClose,
}: {
  target: { proposal: DeskProposal; change: "lost" | "archived" } | null;
  onDone: () => void;
  onClose: (proposalId: string, change: "lost" | "archived") => Promise<CloseResult>;
}) {
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const lost = target?.change === "lost";
  async function confirm() {
    if (!target || working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await onClose(target.proposal.id, target.change);
      if (result.ok) onDone();
      else setProblem(result.problem);
    } catch {
      setProblem(CLOSE_COPY.failed);
    } finally {
      setWorking(false);
    }
  }
  return (
    <Dialog
      open={target !== null}
      onOpenChange={(next) => {
        if (next || working) return;
        setProblem(null);
        onDone();
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="close-proposal">
        <DialogHeader>
          <DialogTitle className="page-title">{lost ? CLOSE_COPY.lostTitle : CLOSE_COPY.archiveTitle}</DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">{target ? `${target.proposal.clientName ? `${target.proposal.clientName}: ` : ""}${target.proposal.title}` : ""}</DialogDescription>
        </DialogHeader>
        <p className="text-sm text-foreground">{lost ? CLOSE_COPY.lostBody : CLOSE_COPY.archiveBody}</p>
        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={working} onClick={onDone}>
            {CLOSE_COPY.cancel}
          </Button>
          <Button type="button" variant="outline" disabled={working} onClick={() => void confirm()}>
            {working ? CLOSE_COPY.working : lost ? CLOSE_COPY.confirmLost : CLOSE_COPY.confirmArchive}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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
          <DialogDescription className="break-words [overflow-wrap:anywhere]">{proposal ? `${proposal.clientName ? `${proposal.clientName}: ` : ""}${proposal.title}` : ""}</DialogDescription>
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

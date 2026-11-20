import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";

import { BoardBuildReveal } from "@/components/proposals/BoardBuildReveal";
import { LeadDialog } from "@/components/proposals/LeadPicker";
import { LeadSheet, type LeadSheetStart } from "@/components/proposals/LeadSheet";
import { ProposalRow } from "@/components/proposals/ProposalRow";
import { useRowFlip } from "@/components/proposals/use-row-flip";
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
  pastWorkByLead,
  upNextId,
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
 * 20 Nov 2026, the Proposal Desk's dashboard: four views (All open, Needs me, Won, Lost) over the proposals this
 * person may see. One row per proposal: who it is for, what they asked for, how long it has left against the
 * workspace's own goal, and its context documents. Nothing here rates or ranks a person; a row names only who started it.
 *
 * 20 Nov 2026 (Liam, D-86): the proposal closest to its goal that this person can move is Up next, at the top, and
 * its next step is the one filled button on the page. Rows travel to their new place when they change.
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
  startLead,
  startLeadFresh = true,
  onStartLeadDone,
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
        /** The words for the saved lead, or for a person picked on the sheet and not saved yet. Reads only. */
        preview: (proposalId: string, contactId?: string) => Promise<AskPreview>;
        send: (proposalId: string, pressId: string) => Promise<AskResult>;
        practiceReply: (proposalId: string, reply: Reply) => Promise<PracticeReplyResult>;
      }
    | undefined;
  /** Closes an open proposal as lost, or archives one made by mistake. */
  onClose?: ((proposalId: string, change: "lost" | "archived") => Promise<CloseResult>) | undefined;
  /** A proposal just made by New proposal: the lead sheet opens on it at once, for people who may pick a lead. */
  startLead?: string | null | undefined;
  /** False when the sheet opens from a link (an admin's Home), not straight after New proposal: no "just started" words. */
  startLeadFresh?: boolean | undefined;
  /** The sheet opened for a new proposal has closed, saved or not. */
  onStartLeadDone?: (() => void) | undefined;
}) {
  // With asking available, picking and asking are one sheet; it opens on the list, or on the confirm for a saved lead.
  const [sheet, setSheet] = useState<{ proposal: DeskProposal; start: LeadSheetStart } | null>(null);
  const [closing, setClosing] = useState<{ proposal: DeskProposal; change: "lost" | "archived" } | null>(null);
  const [leading, setLeading] = useState<DeskProposal | null>(null);
  const picks = Boolean(data.canPickLead && onLead);
  // Worked out from the props, not set in an effect, so the sheet is there in the same render as the form leaves.
  const startProposal = startLead && picks && ask ? data.proposals.find((proposal) => proposal.id === startLead && proposal.status === "open") : undefined;
  const sheetTarget = sheet ?? (startProposal ? { proposal: startProposal, start: "pick" as const, fresh: startLeadFresh } : null);
  const [view, setView] = useState<DeskView>(initialView ?? "open");
  const [winning, setWinning] = useState<DeskProposal | null>(null);
  const counts = deskCounts(data.proposals);
  const all = deskView(data.proposals, view);
  const shown = limit ? all.slice(0, limit) : all;
  // Up next leads the list; the rows above it in reading order are ones this person cannot move.
  const upNext = view === "open" || view === "mine" ? upNextId(shown, { send: Boolean(onSent), win: Boolean(onWin) }) : null;
  const rows = upNext ? [...shown.filter((p) => p.id === upNext), ...shown.filter((p) => p.id !== upNext)] : shown;
  const listRef = useRef<HTMLUListElement>(null);
  useRowFlip(listRef);

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

      {rows.length === 0 ? (
        <p data-desk-empty className="text-sm text-muted-foreground">
          {DESK_COPY.empty[view]}
        </p>
      ) : (
        <ul ref={listRef} className="flex flex-col gap-2 animate-in fade-in-0 duration-500 motion-reduce:animate-none">
          {rows.map((proposal) => (
            <ProposalRow key={proposal.id} featured={proposal.id === upNext} proposal={proposal} goalHours={data.goalHours} now={now} onSent={onSent} onWin={onWin ? () => setWinning(proposal) : undefined}
              lead={picks ? { person: roster?.find((person) => person.id === proposal.leadContactId), onPick: () => (ask ? setSheet({ proposal, start: "pick" }) : setLeading(proposal)) } : undefined}
              ask={picks && ask ? { onAsk: () => setSheet({ proposal, start: "confirm" }), onPracticeReply: (reply) => ask.practiceReply(proposal.id, reply) } : undefined}
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
      {picks && onLead && !ask ? <LeadDialog proposal={leading} roster={roster} words={leadWords ?? ""} demo={data.texts.demo} onClose={() => setLeading(null)} onSave={onLead} /> : null}
      {picks && ask && onLead ? (
        <LeadSheet target={sheetTarget} roster={roster} wonWords={leadWords ?? ""} demo={data.texts.demo} connected={data.texts.connected} preview={ask.preview} send={ask.send} onSave={onLead} pastWork={pastWorkByLead(data.proposals)} onClose={() => (sheet ? setSheet(null) : onStartLeadDone?.())} />
      ) : null}
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
      <DialogContent className={cn("sm:max-w-md", working ? "sm:max-w-xl" : null)} data-testid="win-proposal">
        <DialogHeader>
          <DialogTitle className="page-title">{WIN_COPY.title}</DialogTitle>
          <DialogDescription className="break-words [overflow-wrap:anywhere]">{proposal ? `${proposal.clientName ? `${proposal.clientName}: ` : ""}${proposal.title}` : ""}</DialogDescription>
        </DialogHeader>
        {/* While the board is being made, the dialog shows that board building in (D-86); before, it says what will happen. */}
        {working && proposal ? (
          <BoardBuildReveal
            client={proposal.clientName || proposal.title}
            documents={proposal.contextTitles ?? []}
            documentCount={proposal.contextCount}
            lead={proposal.leadName ?? ""}
            owner={proposal.ownerName}
          />
        ) : (
          <>
            <p className="text-sm text-foreground">{WIN_COPY.body(proposal?.contextCount ?? 0)}</p>
            <p className="text-sm text-muted-foreground">{WIN_COPY.sharing}</p>
          </>
        )}
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

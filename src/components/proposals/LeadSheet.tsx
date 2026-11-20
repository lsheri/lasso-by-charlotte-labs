import { useEffect, useRef, useState } from "react";

import { PhoneBubble, PhoneDevice } from "@/components/proposals/MessageDevices";
import { MessageExamples } from "@/components/proposals/MessageExamples";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PersonFace } from "@/components/ui/person-face";
import { tagVariants } from "@/components/ui/tag";
import { ASK_COPY, SHEET_COPY, type AskPreview, type AskResult } from "@/lib/lead-ask-shared";
import { LEAD_COPY, type DeskProposal, type LeadResult } from "@/lib/proposal-desk-shared";
import { ROSTER_COPY, type RosterContact } from "@/lib/roster-shared";
import { cn } from "@/lib/utils";

/** One piece of past work a person led: who it was for and what it was. Never a fee, a value or a score. */
export type PastWork = { client: string; title: string };
/** The most past work one row shows. */
export const PAST_WORK_SHOWN = 3;

/**
 * 20 Nov 2026 (Liam, card Q-68: "as past work beside each name"). The work a person has led before, so the partner
 * can see who fits. It sits beside the name and says nothing more: no count, no score, no "best match", and it never
 * changes the order of the list. With nothing to show, it renders nothing.
 */
export function LedBefore({ work }: { work: readonly PastWork[] | undefined }) {
  const shown = (work ?? []).filter((item) => item.client || item.title).slice(0, PAST_WORK_SHOWN);
  if (shown.length === 0) return null;
  return (
    <span
      data-led-before
      className="mt-0.5 block break-words text-(length:--type-small) text-muted-foreground [overflow-wrap:anywhere]"
    >
      {SHEET_COPY.ledBefore}{" "}
      {shown
        .map((item) =>
          item.client && item.title ? `${item.client}, ${item.title}` : item.client || item.title,
        )
        .join("; ")}
    </span>
  );
}

export type LeadSheetStart = "pick" | "confirm";

/**
 * 20 Nov 2026 (Liam, card Q-67: "one sheet with a confirm step that feels fluid with the process"). Picking the
 * lead and asking them happen on one surface. Pick a person and the phone fills with their message; press Ask and
 * the same sheet turns into the confirm: who, what goes out, where it goes. Nothing is saved and nothing is sent
 * before the confirm. Saving a lead without asking is still one press, as before.
 *
 * No phone number is ever on this sheet.
 */
export function LeadSheet({
  target,
  roster,
  wonWords,
  demo,
  connected,
  preview,
  send,
  onSave,
  onClose,
  pastWork,
}: {
  /** The proposal, and where the sheet starts: the list, or the confirm when a lead is already saved. */
  target: { proposal: DeskProposal; start: LeadSheetStart } | null;
  /** Undefined while the list loads or when it could not be read. */
  roster: RosterContact[] | undefined;
  /** The won text, exactly as it is sent. */
  wonWords: string;
  /** A demo workspace: its texts go to the demo number, not to the person picked. */
  demo?: boolean | undefined;
  /** Texting is switched on. When it is known to be off, nothing on the sheet may say or imply a text is sent. */
  connected?: boolean | undefined;
  /** The exact words for this person, and anything that would stop the text. Reads only. */
  preview: (proposalId: string, contactId: string) => Promise<AskPreview>;
  send: (proposalId: string, pressId: string) => Promise<AskResult>;
  onSave: (proposalId: string, contactId: string | null) => Promise<LeadResult>;
  onClose: () => void;
  /** Work each person has led before, by roster id. Left out, or empty for a person, the row says nothing. */
  pastWork?: Record<string, readonly PastWork[]> | undefined;
}) {
  const proposal = target?.proposal ?? null;
  const proposalId = proposal?.id ?? null;
  const current = proposal?.leadContactId ?? "";
  const [choice, setChoice] = useState("");
  const [step, setStep] = useState<LeadSheetStart>("pick");
  const [shown, setShown] = useState<{ contactId: string; preview: AskPreview } | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // One id per press at one person. A double click is the same press and sends once. A new pick, or a send that
  // failed, gets a new id: the server answers a repeated id from its first row, so reusing one would leave the
  // second person unasked (QA S1) and make "try again" replay the failure instead of trying.
  const pressId = useRef("");
  const box = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setChoice(current);
    setStep(target?.start === "confirm" && current ? "confirm" : "pick");
    setProblem(null);
    setShown(null);
    // The sheet resets when it opens on a proposal, not each time the page refreshes that proposal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, target?.start]);

  useEffect(() => {
    pressId.current = crypto.randomUUID();
  }, [proposalId, target?.start, choice]);

  // Each step opens at its top, so the title, the name and the action are not left scrolled out of view on a short
  // screen (a phone with its keyboard up, or on its side).
  useEffect(() => {
    if (box.current) box.current.scrollTop = 0;
  }, [step, proposalId]);

  useEffect(() => {
    let live = true;
    if (!proposalId || !choice) return;
    Promise.resolve()
      .then(() => preview(proposalId, choice))
      .then((next) => {
        if (live) setShown({ contactId: choice, preview: next });
      })
      .catch(() => {
        if (live) setShown({ contactId: choice, preview: { ok: false, problem: SHEET_COPY.wordsFailed } });
      });
    return () => {
      live = false;
    };
    // `preview` is a fresh function on every render of the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId, choice]);

  const people = roster ?? [];
  const chosen = people.find((person) => person.id === choice);
  const loaded = shown && shown.contactId === choice ? shown.preview : null;
  const ready = loaded?.ok ? loaded : null;
  // The person picked is no longer on the list (they left it, or the saved lead was removed). Nobody can be asked
  // until someone on the list is picked, so the sheet stays on the list and says so.
  const gone = roster !== undefined && choice !== "" && !chosen;
  const name = gone ? "" : (chosen?.name ?? ready?.name ?? proposal?.leadName ?? "");
  const first = name.trim().split(/\s+/)[0] ?? "";
  const confirm = step === "confirm" && !gone;
  const blocked = !ready || Boolean(ready.warning) || gone;

  async function save(contactId: string | null) {
    if (!proposal || working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await onSave(proposal.id, contactId);
      if (result.ok) onClose();
      else setProblem(result.problem);
    } catch {
      setProblem(LEAD_COPY.failed);
    } finally {
      setWorking(false);
    }
  }

  /** The confirm: saves the pick if it changed, then sends. The only press that does either on the way to an ask. */
  async function confirmAsk() {
    if (!proposal || working || blocked || !choice) return;
    setWorking(true);
    setProblem(null);
    // Each failure names the step that failed: not saved (so nothing sent), or saved but not sent.
    const saving = choice !== current;
    if (saving) {
      try {
        const saved = await onSave(proposal.id, choice);
        if (!saved.ok) {
          setWorking(false);
          return setProblem(SHEET_COPY.notSaved(saved.problem));
        }
      } catch {
        setWorking(false);
        return setProblem(SHEET_COPY.notSaved(LEAD_COPY.failed));
      }
    }
    try {
      const result = await send(proposal.id, pressId.current);
      if (result.ok) return onClose();
      pressId.current = crypto.randomUUID();
      setProblem(saving ? SHEET_COPY.savedNotSent(name, result.problem) : result.problem);
    } catch {
      pressId.current = crypto.randomUUID();
      setProblem(saving ? SHEET_COPY.savedNotSent(name, ASK_COPY.failed) : ASK_COPY.failed);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={proposal !== null}
      onOpenChange={(next) => {
        if (next || working) return;
        onClose();
      }}
    >
      <DialogContent
        ref={box}
        className="max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto sm:max-w-2xl"
        data-testid={confirm ? "ask-lead" : "pick-lead"}
        data-lead-sheet={confirm ? "confirm" : "pick"}
      >
        <DialogHeader>
          <DialogTitle className="page-title break-words [overflow-wrap:anywhere]">
            {confirm
              ? SHEET_COPY.confirmTitle(first)
              : SHEET_COPY.title(proposal?.clientName ?? "")}
          </DialogTitle>
          <DialogDescription>
            {confirm
              ? ready && !ready.warning
                ? SHEET_COPY.goes(ready.mode, first)
                : loaded
                  ? ""
                  : ASK_COPY.loading
              : LEAD_COPY.intro}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-start">
          <div className="min-w-0">
            {/* Step one: the people. It folds away on the confirm, and the person picked stays as one line. */}
            <div
              className="lead-sheet-fold"
              data-folded={confirm}
              aria-hidden={confirm}
              inert={confirm}
            >
              <div>
                {roster === undefined ? (
                  <p role="status" data-lead-no-list className="text-sm text-muted-foreground">
                    {LEAD_COPY.noList}
                  </p>
                ) : people.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{LEAD_COPY.noPeople}</p>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label={LEAD_COPY.select}
                    data-lead-people
                    className="-m-1 flex max-h-72 flex-col gap-1 overflow-y-auto p-1"
                  >
                    {people.map((person) => {
                      const on = person.id === choice;
                      return (
                        <button
                          key={person.id}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          data-lead-person={person.id}
                          disabled={working}
                          className={cn(
                            "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--corner-panel) border px-3 py-2 text-left disabled:opacity-50",
                            on
                              ? "border-[var(--action-edge)] bg-[var(--action-wash)]"
                              : "border-transparent hover:bg-muted",
                          )}
                          onClick={() => {
                            setChoice(person.id);
                            setProblem(null);
                          }}
                        >
                          <PersonFace name={person.name} />
                          <span className="min-w-[6.5rem] flex-1">
                            <span className="block break-words text-(length:--type-control) font-medium text-foreground [overflow-wrap:anywhere]">
                              {person.name}
                            </span>
                            {person.role ? (
                              <span className="block break-words text-(length:--type-small) text-muted-foreground [overflow-wrap:anywhere]">
                                {person.role}
                              </span>
                            ) : null}
                            <LedBefore work={pastWork?.[person.id]} />
                          </span>
                          <span
                            className={cn(
                              tagVariants({
                                tone: person.texts === "agreed" ? "accent" : "outline",
                              }),
                              "ms-auto shrink-0",
                            )}
                          >
                            {ROSTER_COPY.texts[person.texts]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {/* Step two: who it is, in one line. */}
            <div className="lead-sheet-fold" data-folded={!confirm} aria-hidden={!confirm}>
              <div>
                <p
                  data-lead-confirm-who
                  className="flex items-center gap-3 rounded-(--corner-panel) border border-[var(--action-edge)] bg-[var(--action-wash)] px-3 py-2"
                >
                  <PersonFace name={name} />
                  <span className="min-w-0 flex-1 break-words text-(length:--type-control) font-medium text-foreground [overflow-wrap:anywhere]">
                    {name}
                  </span>
                  {ready?.mode === "practice" ? (
                    <span className={tagVariants({ tone: "outline" })}>{ASK_COPY.practiceTag}</span>
                  ) : null}
                </p>
              </div>
            </div>
            {chosen && !confirm && !ready?.warning ? (
              <p data-lead-texts={chosen.texts} className="mt-3 text-sm text-foreground">
                {chosen.texts === "agreed"
                  ? LEAD_COPY.agreed(chosen.name)
                  : chosen.texts === "unknown"
                    ? LEAD_COPY.unknown(chosen.name)
                    : LEAD_COPY.notAgreed(chosen.name)}
              </p>
            ) : null}
            {!confirm ? (
              <p data-lead-today={connected === false ? "off" : demo ? "demo" : "real"} className="mt-2 text-sm text-muted-foreground">
                {connected === false ? SHEET_COPY.off(Boolean(demo)) : LEAD_COPY.where(Boolean(demo))}
              </p>
            ) : null}
            {gone ? (
              <p data-lead-gone role="status" className="mt-3 text-sm text-foreground">
                {ASK_COPY.missing}
              </p>
            ) : null}
            {ready?.warning && !gone ? (
              <p data-ask-warning className="mt-3 text-sm text-foreground">
                {ready.warning}
              </p>
            ) : null}
            {loaded && !loaded.ok && !gone ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {loaded.problem}
              </p>
            ) : null}
            {problem ? (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {problem}
              </p>
            ) : null}
          </div>
          {/* The phone stays where it is through both steps: the same message, first as a preview, then as what goes out. */}
          <div className="flex min-w-0 flex-col items-center gap-2">
            {/* A first name of 30 or more unbroken letters must wrap here, or it pushes the sheet wide and Cancel and Send off the screen. */}
            <p data-ask-gets className="micro-label max-w-full min-w-0 self-start break-words [overflow-wrap:anywhere]">
              {choice
                ? ASK_COPY.gets(name, ready?.mode === "real" && !ready.warning)
                : SHEET_COPY.pickFirst}
            </p>
            <PhoneDevice kind="text">
              {ready ? <PhoneBubble data-ask-words="">{ready.words}</PhoneBubble> : null}
            </PhoneDevice>
          </div>
        </div>
        {!confirm ? (
          <details className="text-(length:--type-small)">
            <summary className="cursor-pointer text-muted-foreground">{LEAD_COPY.preview}</summary>
            <div className="mt-2">
              <MessageExamples words={wonWords} off={connected === false} />
            </div>
          </details>
        ) : null}
        {/* The actions stay in view at the foot of the sheet however long the list or the phone above them is. */}
        <div
          data-lead-actions
          className="sticky -bottom-4 z-10 -mx-4 -mb-4 sm:-bottom-6 flex flex-wrap justify-end gap-2 border-t border-border bg-background px-4 py-3 sm:-mx-6 sm:-mb-6 sm:px-6"
        >
          {confirm ? (
            <>
              <Button
                type="button"
                variant="ghost"
                disabled={working}
                onClick={() => {
                  setStep("pick");
                  setProblem(null);
                }}
              >
                {SHEET_COPY.back}
              </Button>
              <Button type="button" variant="ghost" disabled={working} onClick={onClose}>
                {ASK_COPY.cancel}
              </Button>
              <Button type="button" disabled={working || blocked} onClick={() => void confirmAsk()}>
                {working
                  ? ASK_COPY.sending
                  : ready?.mode === "practice"
                    ? ASK_COPY.sendPractice
                    : ASK_COPY.send}
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" disabled={working} onClick={onClose}>
                {LEAD_COPY.cancel}
              </Button>
              {current ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={working}
                  onClick={() => void save(null)}
                >
                  {LEAD_COPY.clear}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                disabled={working || !choice || choice === current || gone}
                onClick={() => void save(choice)}
              >
                {working ? LEAD_COPY.saving : LEAD_COPY.save}
              </Button>
              <Button
                type="button"
                data-lead-ask
                className="h-auto min-h-9 max-w-full whitespace-normal text-left [overflow-wrap:anywhere]"
                disabled={working || !choice || gone}
                onClick={() => {
                  setStep("confirm");
                  setProblem(null);
                }}
              >
                {SHEET_COPY.ask(first)}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

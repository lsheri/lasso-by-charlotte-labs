import { useEffect, useRef, useState } from "react";

import { PhoneBubble, PhoneDevice } from "@/components/proposals/MessageDevices";
import { MessageExamples } from "@/components/proposals/MessageExamples";
import { PROPOSAL_MORPH } from "@/lib/view-morph";

import "./proposal-morph.css";
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
import { ROSTER_COPY, samePersonName, type RosterContact, type RosterTeammate, type TeammateLinkResult } from "@/lib/roster-shared";
import { cn } from "@/lib/utils";

/** One piece of past work a person led: who it was for and what it was. Never a fee, a value or a score. */
export type PastWork = { client: string; title: string };
/** The most past work one row shows. */
export const PAST_WORK_SHOWN = 2;

/**
 * 20 Nov 2026 (Liam, card Q-68: "as past work beside each name"). The work a person has led before, so the partner
 * can see who fits. It sits beside the name and says nothing more: no count, no score, no "best match", and it never
 * changes the order of the list. With nothing to show, it renders nothing.
 */
export function LedBefore({ work, known = false }: { work: readonly PastWork[] | undefined; /** Past work was read for everyone, so none means none. */ known?: boolean }) {
  // D-86, few words: who it was for, each client once, newest first. The title only when there is no client name.
  const shown = [...new Set((work ?? []).map((item) => item.client || item.title).filter(Boolean))].slice(0, PAST_WORK_SHOWN);
  if (shown.length === 0) {
    // D-86: a person who has led nothing with us says so in a few words, never a blank the partner must read into.
    return known ? (
      <span data-no-past className="mt-0.5 block text-(length:--type-small) text-muted-foreground">
        {SHEET_COPY.noPast}
      </span>
    ) : null;
  }
  return (
    <span
      data-led-before
      className="mt-0.5 block break-words text-(length:--type-small) text-muted-foreground [overflow-wrap:anywhere]"
    >
      {SHEET_COPY.ledBefore}{" "}
      {shown.join("; ")}
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
  inline = false,
  teammates,
  linkTeammate,
}: {
  /** The proposal, and where the sheet starts: the list, or the confirm when a lead is already saved. */
  target: { proposal: DeskProposal; start: LeadSheetStart; /** Opened straight after New proposal saved it. */ fresh?: boolean } | null;
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
  /**
   * 20 Nov 2026, chat pill PR 3b: the same sheet inside the chat's proposal card, with no dialog around it. Every
   * step, word and server call is the sheet's own; only the frame differs. The card's own flow carries on when it closes.
   */
  inline?: boolean | undefined;
  /**
   * 21 Nov 2026, chat pill PR 4a (D-97): teammates with a login who are not on People yet. Picking one links them
   * (their People row, found by their login email, or a new one) and then they are picked like anyone on People.
   */
  teammates?: readonly RosterTeammate[] | undefined;
  linkTeammate?: ((profileId: string, contactId?: string) => Promise<TeammateLinkResult>) | undefined;
}) {
  const proposal = target?.proposal ?? null;
  const fresh = Boolean(target?.fresh);
  const proposalId = proposal?.id ?? null;
  // The morph name is carried only while it arrives, so a later view transition elsewhere cannot pick this box up.
  // Worked out on render (the sheet stays mounted between uses), so it is on from the very first frame.
  const [settled, setSettled] = useState<string | null>(null);
  const arriving = fresh && proposalId !== null && settled !== proposalId;
  useEffect(() => {
    if (!arriving) return;
    const settle = setTimeout(() => setSettled(proposalId), 700);
    return () => clearTimeout(settle);
  }, [arriving, proposalId]);
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
  // People linked on this sheet, shown at once while the list refreshes behind it.
  const [linked, setLinked] = useState<{ profileId: string; contact: RosterContact }[]>([]);
  const [linking, setLinking] = useState<string | null>(null);
  /**
   * QA M2 of PR 298: a teammate picked but not on People yet. Nothing is written until Save lead or Ask. `match` is a
   * People row with the same name (QA M1): the sheet asks whether it is them; `linkTo` is that row once they say yes.
   */
  const [pending, setPending] = useState<{ mate: RosterTeammate; match: RosterContact | null; answered: boolean; linkTo: string | null } | null>(null);

  useEffect(() => {
    setChoice(current);
    setPending(null);
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

  const listed = roster ?? [];
  const people = [...listed, ...linked.map((entry) => entry.contact).filter((person) => !listed.some((row) => row.id === person.id))];
  const chosen = people.find((person) => person.id === choice);
  const freeTeammates = linkTeammate ? (teammates ?? []).filter((mate) => !linked.some((entry) => entry.profileId === mate.profileId)) : [];
  const insiders = people.filter((person) => person.teammate);
  const outsiders = people.filter((person) => !person.teammate);
  const grouped = insiders.length > 0 || freeTeammates.length > 0;
  const loaded = shown && shown.contactId === choice ? shown.preview : null;
  const ready = loaded?.ok ? loaded : null;
  // The person picked is no longer on the list (they left it, or the saved lead was removed). Nobody can be asked
  // until someone on the list is picked, so the sheet stays on the list and says so.
  const gone = roster !== undefined && choice !== "" && !chosen;
  const name = gone ? "" : (pending?.mate.name ?? chosen?.name ?? ready?.name ?? proposal?.leadName ?? "");
  /** Someone is picked: a person on People, or a teammate who joins People on Save lead or Ask. */
  const picked = Boolean(choice) || pending !== null;
  /** A same-name question waits for its answer before anything can be saved or asked. */
  const asking = Boolean(pending?.match && !pending.answered);
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

  /** A teammate not on People yet is picked locally; nothing is written until Save lead or Ask (QA M2 of PR 298). */
  function pickTeammate(mate: RosterTeammate) {
    if (working || linking) return;
    const same = outsiders.filter((person) => samePersonName(person.name, mate.name));
    setPending({ mate, match: same.length === 1 ? same[0]! : null, answered: false, linkTo: null });
    setChoice("");
    setProblem(null);
  }

  /** The admin's answer to "already on People: link them?". Still nothing is written. */
  function answer(link: boolean) {
    if (!pending?.match) return;
    setPending({ ...pending, answered: true, linkTo: link ? pending.match.id : null });
    setChoice(link ? pending.match.id : "");
  }

  /**
   * On Save lead or Ask: the picked teammate's People row is linked (the one they said yes to, else found by login
   * email, else made), and its id comes back. With no teammate pending, the person already picked.
   */
  async function settle(): Promise<string | null> {
    if (!pending) return choice || null;
    if (!linkTeammate) return null;
    setLinking(pending.mate.profileId);
    try {
      const result = await linkTeammate(pending.mate.profileId, pending.linkTo ?? undefined);
      if (!result.ok) {
        setProblem(LEAD_COPY.linkProblems[result.reason]);
        return null;
      }
      setLinked((before) => [...before.filter((entry) => entry.profileId !== pending.mate.profileId), { profileId: pending.mate.profileId, contact: result.contact }]);
      setPending(null);
      setChoice(result.contact.id);
      return result.contact.id;
    } catch {
      setProblem(LEAD_COPY.linkProblems.unavailable);
      return null;
    } finally {
      setLinking(null);
    }
  }

  async function saveLead() {
    if (!proposal || working || asking) return;
    setProblem(null);
    const id = await settle();
    if (id) await save(id);
  }

  async function toAsk() {
    if (working || asking) return;
    setProblem(null);
    if (pending && !(await settle())) return;
    setStep("confirm");
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

  /** One person on People, as a choice. Teammates carry a tag saying so. */
  const personRow = (person: RosterContact) => {
    const on = person.id === choice;
    return (
      <button
        key={person.id}
        type="button"
        role="radio"
        aria-checked={on}
        data-lead-person={person.id}
        disabled={working || linking !== null}
        className={cn(
          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--corner-panel) border px-3 py-2 text-left disabled:opacity-50",
          on ? "border-[var(--action-edge)] bg-[var(--action-wash)]" : "border-transparent hover:bg-muted",
        )}
        onClick={() => {
          setPending(null);
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
          <LedBefore work={pastWork?.[person.id]} known={pastWork !== undefined} />
        </span>
        {person.teammate ? <span className={cn(tagVariants({ tone: "outline" }), "ms-auto shrink-0")}>{LEAD_COPY.teammateTag}</span> : null}
        <span
          className={cn(
            tagVariants({
              tone: person.texts === "agreed" ? "accent" : "outline",
            }),
            person.teammate ? "shrink-0" : "ms-auto shrink-0",
          )}
        >
          {ROSTER_COPY.texts[person.texts]}
        </span>
      </button>
    );
  };

  const title = (
    <>
            {confirm
              ? SHEET_COPY.confirmTitle(first)
              : SHEET_COPY.title(proposal?.clientName ?? "")}
          </>
  );
  const description = (
    <>
            {confirm
              ? ready && !ready.warning
                ? SHEET_COPY.goes(ready.mode, first)
                : loaded
                  ? ""
                  : ASK_COPY.loading
              : fresh
                ? `${SHEET_COPY.started} ${LEAD_COPY.intro}`
                : LEAD_COPY.intro}
          </>
  );
  const body = (
    <>
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
                ) : people.length === 0 && freeTeammates.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{LEAD_COPY.noPeople}</p>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label={LEAD_COPY.select}
                    data-lead-people
                    className="-m-1 flex max-h-72 flex-col gap-1 overflow-y-auto p-1"
                  >
                    {grouped ? <p aria-hidden data-lead-group="teammates" className="micro-label px-1 pt-1">{LEAD_COPY.teammates}</p> : null}
                    {insiders.map((person) => personRow(person))}
                    {freeTeammates.map((mate) => (
                      <button
                        key={mate.profileId}
                        type="button"
                        role="radio"
                        aria-checked={pending?.mate.profileId === mate.profileId}
                        aria-busy={linking === mate.profileId}
                        data-lead-teammate={mate.profileId}
                        disabled={working || linking !== null}
                        className={cn(
                          "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--corner-panel) border px-3 py-2 text-left disabled:opacity-50",
                          pending?.mate.profileId === mate.profileId ? "border-[var(--action-edge)] bg-[var(--action-wash)]" : "border-transparent hover:bg-muted",
                        )}
                        onClick={() => pickTeammate(mate)}
                      >
                        <PersonFace name={mate.name} />
                        <span className="min-w-[6.5rem] flex-1">
                          <span className="block break-words text-(length:--type-control) font-medium text-foreground [overflow-wrap:anywhere]">
                            {mate.name}
                          </span>
                          {linking === mate.profileId ? (
                            <span role="status" className="block text-(length:--type-small) text-muted-foreground">
                              {LEAD_COPY.linking(mate.name)}
                            </span>
                          ) : null}
                        </span>
                        <span className={cn(tagVariants({ tone: "outline" }), "ms-auto shrink-0")}>{LEAD_COPY.teammateTag}</span>
                      </button>
                    ))}
                    {grouped && outsiders.length > 0 ? <p aria-hidden data-lead-group="outside" className="micro-label px-1 pt-2">{LEAD_COPY.outside}</p> : null}
                    {outsiders.map((person) => personRow(person))}
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
            {pending && !confirm ? (
              asking && pending.match ? (
                <div data-lead-same-name role="group" aria-label={LEAD_COPY.sameName(pending.mate.name)} className="mt-3 flex flex-col gap-2 text-sm text-foreground">
                  <p>{LEAD_COPY.sameName(pending.mate.name)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={() => answer(true)}>
                      {LEAD_COPY.linkThem}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => answer(false)}>
                      {LEAD_COPY.keepApart}
                    </Button>
                  </div>
                </div>
              ) : (
                <p data-lead-on-save className="mt-3 text-sm text-muted-foreground">
                  {pending.linkTo ? LEAD_COPY.linkOnSave(pending.mate.name) : LEAD_COPY.addOnSave(pending.mate.name)}
                </p>
              )
            ) : null}
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
              <Button type="button" variant="ghost" disabled={working} onClick={onClose} data-lead-later={fresh ? "" : undefined}>
                {fresh ? SHEET_COPY.pickLater : LEAD_COPY.cancel}
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
                disabled={working || linking !== null || asking || !picked || (!pending && choice === current) || gone}
                onClick={() => void saveLead()}
              >
                {working ? LEAD_COPY.saving : LEAD_COPY.save}
              </Button>
              <Button
                type="button"
                data-lead-ask
                className="h-auto min-h-9 max-w-full whitespace-normal text-left [overflow-wrap:anywhere]"
                disabled={working || linking !== null || asking || !picked || gone}
                onClick={() => void toAsk()}
              >
                {SHEET_COPY.ask(first)}
              </Button>
            </>
          )}
        </div>
    </>
  );

  if (inline) {
    if (!proposal) return null;
    return (
      <section
        ref={box as never}
        className="lead-sheet-inline grid min-w-0 gap-3"
        aria-label={confirm ? SHEET_COPY.confirmTitle(first) : SHEET_COPY.title(proposal.clientName)}
        data-testid={confirm ? "ask-lead" : "pick-lead"}
        data-lead-sheet={confirm ? "confirm" : "pick"}
        data-lead-inline=""
      >
        <div className="grid gap-1">
          <h3 className="text-base font-semibold break-words [overflow-wrap:anywhere]">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        {body}
      </section>
    );
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
        // Straight after New proposal, the form's box morphs into this one, so this one does not zoom in by itself.
        // Its own entrance stays off for as long as it is open: turning it back on would replay the zoom. It closes
        // normally, because the close clears `fresh` in the same render. The morph name is carried only while arriving.
        style={fresh ? { animation: "none", ...(arriving ? { viewTransitionName: PROPOSAL_MORPH } : {}) } : undefined}
        data-lead-fresh={fresh ? "" : undefined}
        data-lead-arriving={arriving ? "" : undefined}
        className="max-h-[90dvh] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto sm:max-w-2xl"
        data-testid={confirm ? "ask-lead" : "pick-lead"}
        data-lead-sheet={confirm ? "confirm" : "pick"}
      >
        <DialogHeader>
          <DialogTitle className="page-title break-words [overflow-wrap:anywhere]">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

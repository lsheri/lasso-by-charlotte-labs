import { useCallback, useEffect, useId, useRef, useState, type ClipboardEvent, type DragEvent, type ReactNode } from "react";

import { PillLeadStep } from "@/components/pill/PillLeadStep";
import { SendDocsPicture } from "@/components/proposals/SendDocsCard";
import { useProposalDesk } from "@/components/proposals/use-proposal-desk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonFace } from "@/components/ui/person-face";
import { StepCard } from "@/components/ui/step-card";
import { Textarea } from "@/components/ui/textarea";
import { FileText, X } from "@/design/brand/icons";
import { BRIEF_READ_MAX, BRIEF_READ_MIN } from "@/lib/brief-read-shared";
import { SEND_DOCS_COPY, type SendDocsResult } from "@/lib/lead-view-shared";
import { BRIEF_PASS_COPY, dueLabel, isBriefPaste, PROPOSAL_CARD_COPY } from "@/lib/pill-proposal-shared";
import { sameClientName } from "@/lib/proposal-desk-shared";
import { firstWord, flowBack, flowMarker, flowSteps, FLOW_COPY, needsSend, type FlowStep } from "@/lib/proposal-flow-shared";
import { STEP_CARD_COPY, stepDirection } from "@/lib/step-card-shared";

import {
  BRIEF_READ_STEPS,
  todayIso,
  useBriefPass,
  useBriefProposal,
  type BriefPassTools,
  type BriefProposalTools,
} from "./use-brief-proposal";
import "./proposal-flow.css";

export type ProposalFlowProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Starts it here. False: a Member on Home, who passes the brief to an admin, as in the chat. */
  mayStart: boolean;
  tools: BriefProposalTools & { goalHours: number };
  passTools: BriefPassTools;
  firmName: string;
  /** The brand's name, for the copy ("Lasso fills in the rest"). */
  brandName: string;
  sendDocs: (proposalId: string, send: boolean) => Promise<SendDocsResult>;
  /** Told once the proposal exists, so the page can read its list again. */
  onStarted?: ((proposalId: string) => void | Promise<void>) | undefined;
  /** The last step's way to the new row. Left out (already on Proposals) the card just closes onto it. */
  onOpenProposal?: ((proposalId: string) => void) | undefined;
  /** "Ask Lasso about this": opens the chat, only if the person wants it. The card stays where it is. */
  onAsk?: (() => void) | undefined;
  reduceMotion: boolean;
  /** The card has been opened at least once: until then nothing is read. */
  woken?: boolean | undefined;
  /** The lead step. Left out, the app's own (the lead sheet with the app's server calls); a story hands in stand-ins. */
  leadStep?: LeadStepRender | undefined;
};

type LeadStepRender = (
  proposalId: string,
  done: () => void,
  onState: (state: { confirm: boolean; working: boolean }) => void,
) => ReactNode;

/**
 * 21 Nov 2026, click path cards (Liam: "clicking through version not using chat should have buttons that pop open
 * pleasant looking white background cards for steps. like the proposals. it shouldnt open chat."; the design note
 * plans/click-path-cards.html). Starting a proposal from a button, as one step card in three steps: Start a proposal
 * (paste the brief or drop the RFP; the client, the ask and the due date fill in for the person to check), Pick the
 * lead, and Send (the ask on an iPhone, then the documents). Every step runs the chat's own code and server calls
 * (useBriefProposal, the lead sheet, Send the documents); only the frame differs. The card's owner keeps this mounted,
 * so closing it by mistake keeps what was typed and the step it was on; once finished, the next one starts fresh.
 */
export function ProposalFlow(props: ProposalFlowProps) {
  const [round, setRound] = useState(0);
  return <ProposalFlowRound key={round} {...props} onFinished={() => setRound((n) => n + 1)} />;
}

function ProposalFlowRound({
  open,
  onOpenChange,
  mayStart,
  tools,
  passTools,
  firmName,
  brandName,
  sendDocs,
  onStarted,
  onOpenProposal,
  onAsk,
  reduceMotion,
  woken = true,
  leadStep,
  onFinished,
}: ProposalFlowProps & { onFinished: () => void }) {
  const ids = useId();
  const flow = useBriefProposal(tools, reduceMotion);
  const pass = useBriefPass(passTools, !mayStart && woken);
  const desk = useProposalDesk(mayStart && woken ? tools.profileId : undefined);
  const canPickLead = Boolean(desk.data?.canPickLead);
  const steps = flowSteps({ mayStart, canPickLead });
  const [step, setStep] = useState<FlowStep>(mayStart ? "start" : "brief");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [text, setText] = useState("");
  const [readText, setReadText] = useState<string | null>(null);
  const [briefProblem, setBriefProblem] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendProblem, setSendProblem] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sheet, setSheet] = useState({ confirm: false, working: false });
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const onSheet = useCallback((state: { confirm: boolean; working: boolean }) => setSheet(state), []);

  // The fields are open for typing from the first moment; reading the brief fills what is still empty.
  const opened = useRef(false);
  useEffect(() => {
    if (!open || opened.current || !mayStart) return;
    opened.current = true;
    void flow.blank("");
    // Once per card.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mayStart]);

  const proposal = flow.proposalId ? desk.data?.proposals.find((row) => row.id === flow.proposalId) : undefined;
  const client = (proposal?.clientName ?? flow.draft.client).trim();
  const leadFirst = firstWord(proposal?.leadName);
  const finished = step === "done" || step === "passed" || pass.state === "sent";

  function go(next: FlowStep) {
    const all: FlowStep[] = ["brief", "pass", ...steps, "done", "passed"];
    setDirection(stepDirection(all.indexOf(step), all.indexOf(next)));
    setStep(next);
  }

  function close(next: boolean) {
    if (next) return onOpenChange(true);
    onOpenChange(false);
    if (finished) window.setTimeout(onFinished, 500);
  }

  function read(from: string) {
    const clean = from.trim();
    if (clean.length < BRIEF_READ_MIN || flow.stage === "reading" || flow.stage === "starting") return;
    setReadText(clean);
    void flow.begin(clean);
  }

  /** A paste that reads as a brief fills the fields at once, as the chat does. */
  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    const pasted = event.clipboardData?.getData("text") ?? "";
    const target = event.currentTarget;
    window.setTimeout(() => {
      if (isBriefPaste(pasted) || isBriefPaste(target.value)) read(target.value);
    }, 0);
  }

  async function start() {
    const id = await flow.start("lead", text.trim());
    if (!id) return;
    await onStarted?.(id);
    go(canPickLead ? "lead" : "done");
  }

  /** The lead sheet closed: on to the documents if there are any to send, else to the last word. */
  async function afterLead() {
    // The sheet is gone: whatever it last said about saving no longer holds the card.
    setSheet({ confirm: false, working: false });
    const fresh = await desk.refetch().catch(() => null);
    // A read that fails keeps the list it had, so the card still knows what there is to send.
    const row = (fresh?.data ?? desk.data)?.proposals.find((item) => item.id === flow.proposalId);
    go(needsSend(row) ? "send" : "done");
  }

  async function send() {
    if (!flow.proposalId || sending) return;
    setSending(true);
    setSendProblem(null);
    try {
      const result = await sendDocs(flow.proposalId, true);
      if (!result.ok) {
        setSendProblem(result.problem);
        return;
      }
      setSent(true);
      go("done");
    } catch {
      setSendProblem(SEND_DOCS_COPY.failed);
    } finally {
      setSending(false);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    flow.add([...(event.dataTransfer?.files ?? [])].slice(0, 6));
  }

  const marker = flowMarker(step, steps, step === "lead" && sheet.confirm);
  const back = flowBack(step, steps, flow.proposalId !== null);
  const busy = flow.stage === "starting" || sending || pass.state === "sending" || (step === "lead" && sheet.working);
  const askLink = onAsk ? (
    <button type="button" onClick={onAsk}>
      {STEP_CARD_COPY.askAbout(brandName)}
    </button>
  ) : null;

  const common = {
    open,
    onOpenChange: close,
    stepKey: step,
    direction,
    marker: marker ? STEP_CARD_COPY.stepOf(marker.n, marker.total) : null,
    onBack: back && !busy ? () => go(back) : null,
    busy,
    aside: askLink,
    testId: "proposal-flow",
  };

  /* ----- A Member: the brief, then who to tell ----- */
  if (step === "brief") {
    return (
      <StepCard
        {...common}
        title={FLOW_COPY.brief.title}
        intro={FLOW_COPY.brief.passIntro}
        footer={
          <Button
            type="button"
            data-flow-primary=""
            disabled={!text.trim()}
            onClick={() => {
              if (text.trim().length < BRIEF_READ_MIN) return setBriefProblem(FLOW_COPY.brief.tooShort);
              setBriefProblem(null);
              go("pass");
            }}
          >
            {FLOW_COPY.brief.next}
          </Button>
        }
      >
        <div className="flow-field">
          <label className="flow-label" htmlFor={`${ids}-brief`}>
            {FLOW_COPY.brief.label}
          </label>
          <Textarea
            id={`${ids}-brief`}
            value={text}
            maxLength={BRIEF_READ_MAX}
            rows={6}
            placeholder={FLOW_COPY.brief.placeholder}
            onChange={(event) => setText(event.target.value)}
            className="flow-brief"
          />
          {briefProblem ? (
            <p role="alert" className="flow-problem">
              {briefProblem}
            </p>
          ) : null}
        </div>
      </StepCard>
    );
  }

  if (step === "pass" || step === "passed") {
    const done = pass.state === "sent";
    return (
      <StepCard
        {...common}
        stepKey={done ? "passed" : "pass"}
        marker={done ? null : common.marker}
        onBack={done ? null : common.onBack}
        title={done ? FLOW_COPY.passed.title : FLOW_COPY.pass.title}
        intro={done ? BRIEF_PASS_COPY.told(pass.name) : BRIEF_PASS_COPY.line(pass.name)}
        footer={
          done ? (
            <Button type="button" onClick={() => close(false)}>
              {FLOW_COPY.passed.close}
            </Button>
          ) : (
            <Button
              type="button"
              data-flow-primary=""
              disabled={pass.state !== "idle" || pass.admins === null || pass.noAdmin}
              onClick={() => void pass.tell(text.trim())}
            >
              {pass.state === "sending" ? BRIEF_PASS_COPY.telling : BRIEF_PASS_COPY.tell(pass.name)}
            </Button>
          )
        }
      >
        {done ? null : (
          <>
            <blockquote className="flow-quote">{text.trim()}</blockquote>
            {pass.noAdmin ? <p className="flow-note">{BRIEF_PASS_COPY.noAdmin}</p> : null}
            {pass.problem ? (
              <p role="alert" className="flow-problem">
                {pass.problem}
              </p>
            ) : null}
          </>
        )}
      </StepCard>
    );
  }

  /* ----- Step 1: Start a proposal ----- */
  if (step === "start") {
    const reading = flow.stage === "reading";
    const locked = flow.stage !== "check";
    const known = flow.clients.some((c) => sameClientName(c.name, flow.draft.client));
    const filled = flow.reading?.readBy === "model" && readText !== null;
    return (
      <StepCard
        {...common}
        title={FLOW_COPY.start.title}
        intro={FLOW_COPY.start.intro(brandName)}
        footer={
          <Button
            type="button"
            data-start-proposal=""
            data-flow-primary=""
            disabled={locked || !flow.ready || flow.uploading !== null}
            onClick={() => void start()}
          >
            {flow.stage === "starting" ? PROPOSAL_CARD_COPY.starting : canPickLead ? FLOW_COPY.start.next : FLOW_COPY.start.start}
          </Button>
        }
      >
        <div className="flow-field">
          <div className="flow-label-row">
            <label className="flow-label" htmlFor={`${ids}-brief`}>
              {FLOW_COPY.start.brief}
            </label>
            {text.trim().length >= BRIEF_READ_MIN && text.trim() !== readText && !reading ? (
              <button type="button" className="flow-link" onClick={() => read(text)} data-flow-fill="">
                {FLOW_COPY.start.fill}
              </button>
            ) : null}
          </div>
          <Textarea
            id={`${ids}-brief`}
            value={text}
            maxLength={BRIEF_READ_MAX}
            rows={3}
            placeholder={FLOW_COPY.start.placeholder}
            disabled={flow.stage === "starting"}
            onChange={(event) => setText(event.target.value)}
            onPaste={onPaste}
            className="flow-brief"
          />
        </div>
        <div
          className="flow-drop"
          data-over={over ? "" : undefined}
          onDragEnter={(event) => {
            event.preventDefault();
            setOver(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
        >
          <span>{flow.uploading ? PROPOSAL_CARD_COPY.uploading(flow.uploading.done + 1, flow.uploading.total) : FLOW_COPY.start.drop}</span>
          <Button type="button" size="sm" variant="outline" disabled={locked || flow.uploading !== null} onClick={() => file.current?.click()}>
            {PROPOSAL_CARD_COPY.choose}
          </Button>
          <input
            ref={file}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              flow.add([...(event.target.files ?? [])].slice(0, 6));
              event.target.value = "";
            }}
          />
        </div>
        {flow.docs.length ? (
          <ul className="flow-pages" aria-label={PROPOSAL_CARD_COPY.docs}>
            {flow.docs.map((doc) => (
              <li key={doc.id} className="flow-page">
                <span className="flow-page__sheet" aria-hidden>
                  <FileText className="size-5" />
                  <i />
                  <i />
                  <i />
                </span>
                <span className="flow-page__name">{doc.name}</span>
                <button type="button" aria-label={PROPOSAL_CARD_COPY.remove(doc.name)} disabled={locked} onClick={() => flow.removeDoc(doc.id)}>
                  <X aria-hidden className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {reading ? (
          <ol className="flow-stages" aria-live="polite" data-flow-reading="">
            {BRIEF_READ_STEPS.map((line, i) => (
              <li key={line} data-state={i < flow.step ? "done" : i === flow.step ? "now" : "next"}>
                <i aria-hidden />
                <span>{line}</span>
              </li>
            ))}
          </ol>
        ) : null}

        <div className="flow-summary" data-flow-filled={filled ? "" : undefined} aria-busy={reading || undefined}>
          {filled ? <p className="flow-note">{FLOW_COPY.start.filled(brandName)}</p> : null}
          <div className="flow-row">
            <div className="flow-field">
              <label className="flow-label" htmlFor={`${ids}-client`}>
                {PROPOSAL_CARD_COPY.client}
              </label>
              <Input
                id={`${ids}-client`}
                list={`${ids}-clients`}
                value={flow.draft.client}
                maxLength={120}
                disabled={locked}
                onChange={(event) => flow.setDraft((d) => ({ ...d, client: event.target.value }))}
              />
              <datalist id={`${ids}-clients`}>
                {flow.clients.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
              {flow.draft.client.trim() && !known ? (
                <small className="flow-note" data-new-client="">
                  {PROPOSAL_CARD_COPY.newClient}
                </small>
              ) : null}
            </div>
            <div className="flow-field">
              <label className="flow-label" htmlFor={`${ids}-due`}>
                {PROPOSAL_CARD_COPY.due}
              </label>
              <Input
                id={`${ids}-due`}
                type="date"
                min={todayIso()}
                value={flow.draft.dueOn}
                disabled={locked}
                onChange={(event) => flow.setDraft((d) => ({ ...d, dueOn: event.target.value }))}
              />
              {flow.reading?.due ? <small className="flow-note">{`“${flow.reading.due.phrase}” in the brief`}</small> : null}
            </div>
          </div>
          <div className="flow-field">
            <label className="flow-label" htmlFor={`${ids}-ask`}>
              {FLOW_COPY.start.askLabel}
            </label>
            <Input
              id={`${ids}-ask`}
              value={flow.draft.ask}
              maxLength={160}
              disabled={locked}
              onChange={(event) => flow.setDraft((d) => ({ ...d, ask: event.target.value }))}
            />
          </div>
          <p className="flow-clock">{PROPOSAL_CARD_COPY.clockLine(tools.goalHours)}</p>
        </div>
        {flow.problem ? (
          <p role="alert" className="flow-problem">
            {flow.problem}
          </p>
        ) : null}
        {briefProblem ? (
          <p role="alert" className="flow-problem">
            {briefProblem}
          </p>
        ) : null}
      </StepCard>
    );
  }

  /* ----- Step 2 (and 3 on the ask): the lead sheet, picking and then asking, all its own ----- */
  if (step === "lead" && flow.proposalId) {
    return (
      // The lead sheet's own buttons are this step's footer, so the card adds none of its own.
      <StepCard {...common} aside={null} title={FLOW_COPY.lead.title} hideTitle>
        {leadStep ? (
          leadStep(flow.proposalId, () => void afterLead(), onSheet)
        ) : (
          <PillLeadStep
            proposalId={flow.proposalId}
            profileId={tools.profileId}
            firmName={firmName}
            onDone={() => void afterLead()}
            onState={onSheet}
          />
        )}
      </StepCard>
    );
  }

  /* ----- Step 3: the documents, when there are some the lead cannot open yet ----- */
  if (step === "send" && proposal) {
    return (
      <StepCard
        {...common}
        title={FLOW_COPY.send.title(leadFirst)}
        intro={SEND_DOCS_COPY.what(leadFirst)}
        footer={
          <>
            <Button type="button" variant="ghost" disabled={sending} onClick={() => go("done")}>
              {FLOW_COPY.send.later}
            </Button>
            <Button type="button" data-flow-primary="" disabled={sending} onClick={() => void send()}>
              {sending ? SEND_DOCS_COPY.working : FLOW_COPY.send.send}
            </Button>
          </>
        }
      >
        <SendDocsPicture leadName={proposal.leadName ?? ""} titles={proposal.contextTitles ?? []} count={proposal.contextCount} />
        {sendProblem ? (
          <p role="alert" className="flow-problem">
            {sendProblem}
          </p>
        ) : null}
      </StepCard>
    );
  }

  /* ----- The last word: what was made, said plainly, and the way to it ----- */
  const due = dueLabel(proposal?.dueOn ?? flow.draft.dueOn);
  const docCount = proposal?.contextCount ?? flow.docs.length;
  const docsLine =
    docCount === 0 ? FLOW_COPY.done.none : sent || proposal?.leadDocs === "sent" ? FLOW_COPY.done.sent(leadFirst) : FLOW_COPY.done.notSent;
  const id = flow.proposalId;
  return (
    <StepCard
      {...common}
      stepKey="done"
      marker={null}
      onBack={null}
      aside={null}
      title={FLOW_COPY.done.title(client)}
      intro={FLOW_COPY.done.intro(tools.goalHours)}
      footer={
        <>
          {onOpenProposal && id ? (
            <Button type="button" variant="ghost" onClick={() => close(false)}>
              {FLOW_COPY.done.close}
            </Button>
          ) : null}
          <Button
            type="button"
            data-flow-primary=""
            onClick={() => {
              close(false);
              if (onOpenProposal && id) onOpenProposal(id);
            }}
          >
            {onOpenProposal && id ? FLOW_COPY.done.open : FLOW_COPY.done.close}
          </Button>
        </>
      }
    >
      <dl className="flow-done">
        <dt>{FLOW_COPY.done.lead}</dt>
        <dd>
          {proposal?.leadName ? (
            <span className="flow-person">
              <PersonFace name={proposal.leadName} size="sm" />
              {proposal.leadName}
            </span>
          ) : (
            FLOW_COPY.done.noLead
          )}
        </dd>
        <dt>{FLOW_COPY.done.documents}</dt>
        <dd>{docsLine}</dd>
        {due ? (
          <>
            <dt>{FLOW_COPY.done.due}</dt>
            <dd>{due}</dd>
          </>
        ) : null}
      </dl>
    </StepCard>
  );
}

import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  BRIEF_READ_STEPS,
  todayIso,
  useBriefPass,
  useBriefProposal,
  type BriefPassTools,
  type BriefProposalTools,
} from "@/components/proposals/use-brief-proposal";
import {
  BRIEF_PASS_COPY,
  dueLabel,
  PROPOSAL_CARD_COPY as COPY,
} from "@/lib/pill-proposal-shared";
import { sameClientName } from "@/lib/proposal-desk-shared";

export type ProposalCardTools = BriefProposalTools & {
  goalHours: number;
  /** The lead sheet for the new proposal, inside the card. `done` carries the card on when it closes. Null: no picking. */
  leadStep: ((proposalId: string, done: () => void) => ReactNode) | null;
  /** Flies the card into its row on Proposals and tucks the chat away. */
  land: (source: HTMLElement | null, proposalId: string, client: string) => Promise<void>;
};

export type PassTools = BriefPassTools;

/**
 * 20 Nov 2026, chat pill PR 3b (Liam, D-111): a pasted brief builds a proposal in the chat. The card reads the brief
 * (the model proposes, code keeps only what the paste says word for word), builds the client, the ask and the due date
 * in front of the person, takes documents dropped on it, and starts the proposal through New proposal's own call. The
 * same card then becomes the lead sheet, and once the lead is picked it flies into its row on Proposals.
 * Nothing is saved until "Start the proposal"; giving up leaves the uploads removed again.
 */
export function PillProposalCard({
  text,
  tools,
  reduceMotion,
  onAskInstead,
}: {
  text: string;
  tools: ProposalCardTools;
  reduceMotion: boolean;
  /** QA M1 of PR 296: a paste read as a brief that was really a question is asked of the firm instead. */
  onAskInstead?: (() => void) | undefined;
}) {
  const flow = useBriefProposal(tools, reduceMotion);
  const { stage, step, reading, draft, setDraft, docs, clients, uploading, problem, proposalId, add, removeDoc } = flow;
  const [over, setOver] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const ids = useId();
  const steps = BRIEF_READ_STEPS;
  const begin = () => flow.begin(text);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
    // Read once per card; "Try again" reads again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    add([...(event.dataTransfer?.files ?? [])].slice(0, 6));
  }

  async function start() {
    const id = await flow.start(tools.leadStep ? "lead" : "landed");
    if (id && !tools.leadStep) await tools.land(box.current, id, draft.client.trim());
  }

  async function landNow(id: string) {
    flow.setStage("landed");
    await tools.land(box.current, id, draft.client.trim());
  }

  const client = draft.client.trim();
  const shown = stage !== "reading" && stage !== "readFailed" && stage !== "idle";
  const caption =
    stage === "reading" || stage === "idle"
      ? steps[step]
      : stage === "readFailed"
        ? COPY.readFailed
        : proposalId
          ? COPY.started(client)
          : COPY.ready(client);

  return (
    <div
      className="chat-pill__brief"
      data-proposal-card={stage}
      data-reduce-motion={reduceMotion ? "" : undefined}
    >
      <p>{COPY.intro(tools.goalHours)}</p>
      <div
        ref={box}
        className="chat-pill__pcard"
        data-building={stage === "reading" || stage === "idle" ? "" : undefined}
        data-done={shown ? "" : undefined}
      >
        <div className="chat-pill__cap" aria-live="polite">
          <i className="chat-pill__cap-dot" aria-hidden="true" />
          <span>{caption}</span>
          {stage === "reading" || stage === "idle" ? (
            <span className="chat-pill__cap-pct">
              {Math.round(((step + 1) / steps.length) * 100)}%
            </span>
          ) : null}
        </div>

        {stage === "readFailed" ? (
          <div className="chat-pill__acts">
            {problem ? (
              <p role="alert" className="text-sm">
                {problem}
              </p>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => void begin()}>
              {COPY.tryAgain}
            </Button>
          </div>
        ) : null}

        {shown && stage !== "lead" ? (
          <div className="chat-pill__pgrid">
            <label className="chat-pill__k" htmlFor={`${ids}-client`}>
              {COPY.client}
            </label>
            <div className="chat-pill__v chat-pill__pc">
              {proposalId ? (
                <b className="chat-pill__big">{client}</b>
              ) : (
                <>
                  <Input
                    id={`${ids}-client`}
                    list={`${ids}-clients`}
                    value={draft.client}
                    maxLength={120}
                    disabled={stage !== "check"}
                    onChange={(event) => setDraft((d) => ({ ...d, client: event.target.value }))}
                    className="chat-pill__field chat-pill__field--big"
                  />
                  <datalist id={`${ids}-clients`}>
                    {clients.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  {!reading?.client && !draft.client.trim() ? (
                    <small>{COPY.noClient}</small>
                  ) : draft.client.trim() &&
                    !clients.some((c) => sameClientName(c.name, draft.client)) ? (
                    <small data-new-client>{COPY.newClient}</small>
                  ) : null}
                </>
              )}
            </div>
            <label className="chat-pill__k" htmlFor={`${ids}-ask`}>
              {COPY.ask}
            </label>
            <div className="chat-pill__v chat-pill__pc">
              {proposalId ? (
                draft.ask
              ) : (
                <>
                  <Input
                    id={`${ids}-ask`}
                    value={draft.ask}
                    maxLength={160}
                    disabled={stage !== "check"}
                    onChange={(event) => setDraft((d) => ({ ...d, ask: event.target.value }))}
                    className="chat-pill__field"
                  />
                  {!reading?.ask ? <small>{COPY.noAsk}</small> : null}
                </>
              )}
            </div>
            <label className="chat-pill__k" htmlFor={`${ids}-due`}>
              {COPY.due}
            </label>
            <div className="chat-pill__v chat-pill__pc">
              {proposalId ? (
                dueLabel(draft.dueOn) || COPY.noneGiven
              ) : (
                <>
                  <Input
                    id={`${ids}-due`}
                    type="date"
                    min={todayIso()}
                    value={draft.dueOn}
                    disabled={stage !== "check"}
                    onChange={(event) => setDraft((d) => ({ ...d, dueOn: event.target.value }))}
                    className="chat-pill__field chat-pill__field--date"
                  />
                  {reading?.due ? (
                    <small>“{reading.due.phrase}” in the brief</small>
                  ) : (
                    <small>{COPY.noDue}</small>
                  )}
                </>
              )}
            </div>
            <span className="chat-pill__k">{COPY.clock}</span>
            <span className="chat-pill__v chat-pill__pc">{COPY.clockLine(tools.goalHours)}</span>
          </div>
        ) : null}

        {stage === "check" || stage === "starting" ? (
          <div className="chat-pill__docarea">
            <p>{COPY.docs}</p>
            <div
              className="chat-pill__drop"
              data-over={over ? "" : undefined}
              onDragEnter={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              <span>
                {uploading ? COPY.uploading(uploading.done + 1, uploading.total) : COPY.drop}
              </span>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={stage !== "check" || uploading !== null}
                onClick={() => file.current?.click()}
              >
                {COPY.choose}
              </Button>
              <input
                ref={file}
                type="file"
                multiple
                hidden
                onChange={(event) => {
                  add([...(event.target.files ?? [])].slice(0, 6));
                  event.target.value = "";
                }}
              />
            </div>
            {docs.length ? (
              <ul className="chat-pill__docs">
                {docs.map((doc) => (
                  <li key={doc.id} className="chat-pill__doc">
                    <span>{doc.name}</span>
                    <button
                      type="button"
                      aria-label={COPY.remove(doc.name)}
                      disabled={stage !== "check"}
                      onClick={() => removeDoc(doc.id)}
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {problem ? (
              <p role="alert" className="text-sm">
                {problem}
              </p>
            ) : null}
            <div className="chat-pill__acts">
              <Button
                type="button"
                data-start-proposal
                disabled={stage !== "check" || !flow.ready || uploading !== null}
                onClick={() => void start()}
              >
                {stage === "starting" ? COPY.starting : COPY.start}
              </Button>
              {onAskInstead && stage === "check" ? (
                <Button type="button" variant="ghost" onClick={onAskInstead}>
                  {COPY.askInstead}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {stage === "lead" && proposalId && tools.leadStep ? (
          <div className="chat-pill__leadstep">
            <p>{COPY.next}</p>
            {tools.leadStep(proposalId, () => void landNow(proposalId))}
          </div>
        ) : null}

        {stage === "landed" && proposalId && !tools.leadStep ? (
          <p className="text-sm">{COPY.noPicking}</p>
        ) : null}
      </div>
    </div>
  );
}

/** A Member's paste: offered to the admins, sent only on the press. */
export function PillBriefPass({
  text,
  tools,
  onAskInstead,
}: {
  text: string;
  tools: PassTools;
  onAskInstead?: (() => void) | undefined;
}) {
  const { admins, name, state, problem, tell: pass } = useBriefPass(tools);
  const tell = () => pass(text);

  return (
    <div className="chat-pill__brief" data-brief-pass={state}>
      <p>{BRIEF_PASS_COPY.line(name)}</p>
      {state === "sent" ? (
        <p role="status">{BRIEF_PASS_COPY.told(name)}</p>
      ) : (
        <div className="chat-pill__acts">
          <Button
            size="sm"
            variant="outline"
            disabled={state !== "idle" || admins === null || admins.count === 0}
            onClick={() => void tell()}
          >
            {state === "sending" ? BRIEF_PASS_COPY.telling : BRIEF_PASS_COPY.tell(name)}
          </Button>
          {onAskInstead && state === "idle" ? (
            <Button size="sm" variant="ghost" onClick={onAskInstead}>
              {COPY.askInstead}
            </Button>
          ) : null}
        </div>
      )}
      {admins && admins.count === 0 && state === "idle" ? (
        <p className="text-sm">{BRIEF_PASS_COPY.noAdmin}</p>
      ) : null}
      {problem ? (
        <p role="alert" className="text-sm">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BriefReading } from "@/lib/brief-read-shared";
import { FIRM_BRAIN_LIMIT_COPY, isFirmBrainLimit } from "@/lib/firm-brain-limit-shared";
import {
  BRIEF_PASS_COPY,
  draftFrom,
  draftReady,
  dueLabel,
  PROPOSAL_CARD_COPY as COPY,
  PROPOSAL_REVEAL_STEP_MS,
  proposalInput,
  type BriefAdmins,
  type BriefDraft,
  type BriefPassResult,
} from "@/lib/pill-proposal-shared";
import type { DeskClient, NewProposalRaw, NewProposalResult } from "@/lib/proposal-desk-shared";

export type ProposalCardTools = {
  profileId: string;
  goalHours: number;
  read: (text: string) => Promise<BriefReading>;
  clients: () => Promise<DeskClient[]>;
  capture: (
    files: File[],
  ) => Promise<{ ids: string[]; failures: { name: string; reason: string }[] }>;
  discard: (ids: string[]) => Promise<void>;
  create: (input: NewProposalRaw) => Promise<NewProposalResult>;
  /** The lead sheet for the new proposal, inside the card. `done` carries the card on when it closes. Null: no picking. */
  leadStep: ((proposalId: string, done: () => void) => ReactNode) | null;
  /** Flies the card into its row on Proposals and tucks the chat away. */
  land: (source: HTMLElement | null, proposalId: string, client: string) => Promise<void>;
};

export type PassTools = {
  admins: () => Promise<BriefAdmins>;
  pass: (text: string) => Promise<BriefPassResult>;
};

/** Today as a date input's value, so a due date in the past cannot be picked (QA L of PR 296). */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

type Stage = "reading" | "check" | "starting" | "lead" | "landed" | "readFailed";

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
  const [stage, setStage] = useState<Stage>("reading");
  const [step, setStep] = useState(0);
  const [reading, setReading] = useState<BriefReading | null>(null);
  const [draft, setDraft] = useState<BriefDraft>({
    client: "",
    ask: "",
    dueOn: "",
    workItemIds: [],
  });
  // QA M2 of PR 296: documents stay in the browser until Start, so a card left behind (a reload, a closed tab) leaves
  // nothing in the person's work. They upload on Start, and are removed again if the start fails.
  const [docs, setDocs] = useState<{ id: string; name: string; file: File }[]>([]);
  const [clients, setClients] = useState<DeskClient[]>([]);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [over, setOver] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [proposalId, setProposalId] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const ids = useId();
  const steps = [COPY.reading, COPY.askStep, COPY.dueStep, COPY.checkStep];

  async function begin() {
    setStage("reading");
    setStep(0);
    setProblem(null);
    const reveal = (async () => {
      if (reduceMotion) return;
      for (let i = 1; i < steps.length; i += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, PROPOSAL_REVEAL_STEP_MS));
        setStep(i);
      }
      await new Promise((resolve) => window.setTimeout(resolve, PROPOSAL_REVEAL_STEP_MS));
    })();
    try {
      const [read, list] = await Promise.all([
        tools.read(text),
        tools.clients().catch(() => [] as DeskClient[]),
      ]);
      await reveal;
      setReading(read);
      setClients(list);
      setDraft(draftFrom(read));
      setStage("check");
    } catch (error) {
      await reveal;
      setProblem(isFirmBrainLimit(error) ? FIRM_BRAIN_LIMIT_COPY.shown : COPY.readFailed);
      setStage("readFailed");
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void begin();
    // Read once per card; "Try again" reads again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const nextDoc = useRef(1);
  function add(files: File[]) {
    if (!files.length || stage !== "check") return;
    setProblem(null);
    setDocs((list) =>
      [
        ...list,
        ...files.map((file) => ({ id: `doc-${nextDoc.current++}`, name: file.name, file })),
      ].slice(0, 12),
    );
  }

  function removeDoc(id: string) {
    setDocs((list) => list.filter((doc) => doc.id !== id));
  }

  /** Uploads the documents for Start. All or nothing: any failure removes what did upload and says which one. */
  async function upload(): Promise<string[] | null> {
    const ids: string[] = [];
    const failed: string[] = [];
    for (let i = 0; i < docs.length; i += 1) {
      setUploading({ done: i, total: docs.length });
      try {
        const id = (await tools.capture([docs[i]!.file])).ids[0];
        if (id) ids.push(id);
        else failed.push(docs[i]!.name);
      } catch {
        failed.push(docs[i]!.name);
      }
    }
    setUploading(null);
    if (!failed.length) return ids;
    if (ids.length) await tools.discard(ids).catch(() => undefined);
    setProblem(COPY.docsFailed(failed.join(", ")));
    return null;
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setOver(false);
    add([...(event.dataTransfer?.files ?? [])].slice(0, 6));
  }

  async function start() {
    if (stage !== "check" || !reading || !draftReady(draft) || uploading) return;
    setStage("starting");
    setProblem(null);
    let ids: string[] = [];
    try {
      const uploaded = await upload();
      if (!uploaded) {
        setStage("check");
        return;
      }
      ids = uploaded;
      const input = proposalInput(
        { ...draft, workItemIds: ids },
        reading.notes,
        clients,
        tools.profileId,
      );
      const result = await tools.create(input);
      if (!result.ok) {
        if (ids.length) await tools.discard(ids).catch(() => undefined);
        setProblem(result.problem);
        setStage("check");
        return;
      }
      setProposalId(result.id);
      if (tools.leadStep) setStage("lead");
      else await landNow(result.id);
    } catch {
      if (ids.length) await tools.discard(ids).catch(() => undefined);
      setProblem(COPY.failed);
      setStage("check");
    }
  }

  async function landNow(id: string) {
    setStage("landed");
    await tools.land(box.current, id, draft.client.trim());
  }

  const client = draft.client.trim();
  const shown = stage !== "reading" && stage !== "readFailed";
  const caption =
    stage === "reading"
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
        data-building={stage === "reading" ? "" : undefined}
        data-done={shown ? "" : undefined}
      >
        <div className="chat-pill__cap" aria-live="polite">
          <i className="chat-pill__cap-dot" aria-hidden="true" />
          <span>{caption}</span>
          {stage === "reading" ? (
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
                  {!reading?.client ? <small>{COPY.noClient}</small> : null}
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
                disabled={stage !== "check" || !draftReady(draft) || uploading !== null}
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
  const [admins, setAdmins] = useState<BriefAdmins | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    tools
      .admins()
      .then((found) => live && setAdmins(found))
      .catch(() => live && setAdmins({ name: null, count: 0 }));
    return () => {
      live = false;
    };
  }, [tools]);
  const name = admins?.name ?? null;

  async function tell() {
    if (state !== "idle") return;
    setState("sending");
    setProblem(null);
    try {
      const result = await tools.pass(text);
      if (result.ok) setState("sent");
      else {
        setProblem(result.problem);
        setState("idle");
      }
    } catch {
      setProblem(BRIEF_PASS_COPY.failed);
      setState("idle");
    }
  }

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

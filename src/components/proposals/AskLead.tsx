import { useEffect, useRef, useState } from "react";

import { PhoneBubble, PhoneDevice } from "@/components/proposals/MessageDevices";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tagVariants } from "@/components/ui/tag";
import { ASK_COPY, askLine, type AskPreview, type AskResult, type PracticeReplyResult, type Reply } from "@/lib/lead-ask-shared";
import type { DeskProposal } from "@/lib/proposal-desk-shared";

/**
 * 20 Nov 2026 (Liam, Q-52): one line under an open proposal for the ask sent to its lead: waiting, delivered, said
 * yes, said no, or did not arrive. Admins and leads also get the button that asks, and, for a practice ask in a
 * demo workspace, three buttons to answer it as the lead would. Nothing here shows a number or how long anyone took.
 */
export function AskLine({
  proposal,
  canAsk,
  onAsk,
  onPracticeReply,
  onRecordAnswer,
}: {
  proposal: DeskProposal;
  /** An admin or a lead, with a lead picked on an open proposal. */
  canAsk: boolean;
  onAsk: () => void;
  onPracticeReply?: ((reply: Reply) => Promise<PracticeReplyResult>) | undefined;
  /**
   * 20 Nov 2026 (D-97): given only in a real workspace whose texts have not started. The lead's answer, heard some
   * other way, recorded by hand. While it is offered, asking by text is not: a press could only say nothing was sent.
   */
  onRecordAnswer?: ((reply: "yes" | "no") => Promise<PracticeReplyResult>) | undefined;
}) {
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const ask = proposal.ask ?? null;
  const answering = Boolean(ask && ask.practice && ask.waiting && !ask.reply && onPracticeReply);
  // Asking again is offered once nothing is waiting: the text did not arrive, nobody replied, or (in practice) it was answered.
  const mayAsk = !onRecordAnswer && canAsk && (!ask || !ask.waiting) && !(ask && ask.reply && !ask.practice && ask.name);
  // One answer per lead, as with a text: once they have answered, there is nothing to record.
  const recording = Boolean(onRecordAnswer && canAsk && !(ask && (ask.reply || ask.waiting)));
  if (!ask && !mayAsk && !recording) return null;

  async function answer(reply: Reply) {
    const run = recording && reply !== "stop" ? () => onRecordAnswer?.(reply) : onPracticeReply ? () => onPracticeReply(reply) : null;
    if (!run || working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await run();
      if (!result) return;
      if (!result.ok) setProblem(result.problem);
    } catch {
      setProblem(ASK_COPY.failed);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div data-proposal-ask={ask ? (ask.reply ?? ask.status) : "none"} className="mt-1 flex flex-col gap-1 text-sm text-muted-foreground">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {ask ? (
          <span role="status" className={ask.reply === "yes" ? "text-foreground" : undefined}>
            {askLine(ask)}
          </span>
        ) : null}
        {ask?.practice ? <span className={tagVariants({ tone: "outline" })}>{ASK_COPY.practiceTag}</span> : null}
        {ask?.recorded ? <span className={tagVariants({ tone: "outline" })}>{ASK_COPY.recordedBy(ask.recordedBy ?? "")}</span> : null}
        {mayAsk ? (
          <button type="button" className="underline hover:text-foreground" onClick={onAsk}>
            {ask ? ASK_COPY.again : ASK_COPY.open(proposal.leadName ?? "")}
          </button>
        ) : null}
      </p>
      {answering ? (
        <p data-practice-reply className="flex flex-wrap items-center gap-2">
          <span>{ASK_COPY.practiceReply}</span>
          {(["yes", "no", "stop"] as const).map((reply) => (
            <Button key={reply} type="button" size="sm" variant="outline" disabled={working} onClick={() => void answer(reply)}>
              {reply === "yes" ? ASK_COPY.practiceYes : reply === "no" ? ASK_COPY.practiceNo : ASK_COPY.practiceStop}
            </Button>
          ))}
        </p>
      ) : null}
      {recording ? (
        <p data-record-answer className="flex flex-wrap items-center gap-2">
          <span>{ASK_COPY.recordPrompt}</span>
          {(["yes", "no"] as const).map((reply) => (
            <Button key={reply} type="button" size="sm" variant="outline" disabled={working} onClick={() => void answer(reply)}>
              {reply === "yes" ? ASK_COPY.recordYes : ASK_COPY.recordNo}
            </Button>
          ))}
        </p>
      ) : null}
      {ask?.practice && ask.reply === "stop" ? <p>{ASK_COPY.practiceStopNote}</p> : null}
      {problem ? (
        <p role="alert" className="text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

/** Shows the exact words, and anything that would stop the text, before one press sends it. */
export function AskDialog({
  proposal,
  load,
  send,
  onClose,
}: {
  proposal: DeskProposal | null;
  load: (proposalId: string) => Promise<AskPreview>;
  send: (proposalId: string, pressId: string) => Promise<AskResult>;
  onClose: () => void;
}) {
  const [preview, setPreview] = useState<AskPreview | null>(null);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // One id per opened dialog: a second click, or a retry after a lost reply, is the same press and sends once.
  const pressId = useRef("");
  const proposalId = proposal?.id ?? null;

  useEffect(() => {
    let current = true;
    setPreview(null);
    setProblem(null);
    if (!proposalId) return;
    pressId.current = crypto.randomUUID();
    Promise.resolve()
      .then(() => load(proposalId))
      .then((next) => {
        if (current) setPreview(next);
      })
      .catch(() => {
        if (current) setPreview({ ok: false, problem: ASK_COPY.failed });
      });
    return () => {
      current = false;
    };
    // `load` is a fresh function on every render of the page; the proposal is what this depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposalId]);

  async function press() {
    if (!proposalId || working || !preview?.ok) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await send(proposalId, pressId.current);
      if (result.ok) onClose();
      else setProblem(result.problem);
    } catch {
      setProblem(ASK_COPY.failed);
    } finally {
      setWorking(false);
    }
  }

  const ready = preview?.ok ? preview : null;
  return (
    <Dialog
      open={proposal !== null}
      onOpenChange={(next) => {
        if (next || working) return;
        onClose();
      }}
    >
      <DialogContent className="sm:max-w-md" data-testid="ask-lead">
        <DialogHeader>
          <DialogTitle className="page-title">{ASK_COPY.title}</DialogTitle>
          <DialogDescription>{ready ? (ready.mode === "practice" ? ASK_COPY.practiceHelper : ASK_COPY.helper) : preview ? "" : ASK_COPY.loading}</DialogDescription>
        </DialogHeader>
        {ready ? (
          <div className="flex flex-col items-center gap-2">
            <p data-ask-gets className="micro-label self-start">
              {ASK_COPY.gets(ready.name, ready.mode === "real")}
            </p>
            <PhoneDevice kind="text">
              <PhoneBubble data-ask-words="">{ready.words}</PhoneBubble>
            </PhoneDevice>
          </div>
        ) : null}
        {ready?.mode === "demo" ? <p className="text-sm text-muted-foreground">{ASK_COPY.demoHelper}</p> : null}
        {ready?.warning ? (
          <p data-ask-warning className="text-sm text-foreground">
            {ready.warning}
          </p>
        ) : null}
        {preview && !preview.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {preview.problem}
          </p>
        ) : null}
        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" disabled={working} onClick={onClose}>
            {ASK_COPY.cancel}
          </Button>
          <Button type="button" disabled={working || !ready || Boolean(ready.warning)} onClick={() => void press()}>
            {working ? ASK_COPY.sending : ready?.mode === "practice" ? ASK_COPY.sendPractice : ASK_COPY.send}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

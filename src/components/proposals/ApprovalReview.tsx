import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/ui/step-card";
import { Textarea } from "@/components/ui/textarea";
import { APPROVAL_COPY, APPROVAL_NOTE_MAX, type ApprovalResult, type ApprovalView } from "@/lib/proposal-approval-shared";
import { APPROVAL_CARD_COPY, firstWord } from "@/lib/proposal-flow-shared";
import { STEP_CARD_COPY, stepDirection } from "@/lib/step-card-shared";

import "./proposal-flow.css";

type ReviewStep = "final" | "approve" | "changes";

/**
 * 21 Nov 2026, chat pill Phase 5 (D-97): on a Proposals row, for an admin, the Lead's request. Approving marks it as
 * gone to the client; the line says the Lead gets a text only once texts are approved. The server decides who may: an
 * admin who leads it is told a second admin approves.
 *
 * 21 Nov 2026, click path cards (the design note's Approval card): the row names the request and "Review it" opens a
 * step card. Step 1, the Lead's final as a page, with "Ask for changes" beside "Next: approve"; step 2, Approve and
 * what happens next. Ask for changes is its own step with one short note. Every press is PR 303's own decide call.
 */
export function ApprovalReview({
  approval,
  leadName,
  proposalId,
  decide,
  readFinal,
}: {
  approval: ApprovalView;
  leadName: string;
  proposalId: string;
  decide: (decision: "approved" | "changes_asked", note: string | null) => Promise<ApprovalResult>;
  readFinal: () => Promise<{ ok: true; title: string; text: string } | { ok: false; problem: string }>;
}) {
  const C = APPROVAL_COPY;
  const K = APPROVAL_CARD_COPY;
  const lead = approval.requestedBy || leadName;
  const first = firstWord(lead);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<ReviewStep>("final");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "changes_asked" | null>(null);
  const [doc, setDoc] = useState<{ ok: true; title: string; text: string } | { ok: false; problem: string } | null>(null);

  // The final is read when the card first opens, through the server's own checks, and kept while the card is closed.
  const reader = useRef(readFinal);
  reader.current = readFinal;
  useEffect(() => {
    if (!open || doc) return;
    let live = true;
    reader.current()
      .then((result) => live && setDoc(result))
      .catch(() => live && setDoc({ ok: false, problem: K.finalFailed }));
    return () => {
      live = false;
    };
  }, [open, doc, K.finalFailed]);

  // The request this card last showed. A different one (sent again after changes) starts at its final.
  const seenRequest = useRef<string | null>(null);

  const order: ReviewStep[] = ["final", "approve", "changes"];
  function go(next: ReviewStep) {
    setDirection(stepDirection(order.indexOf(step), order.indexOf(next)));
    setProblem(null);
    setStep(next);
  }

  async function press(decision: "approved" | "changes_asked") {
    if (working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await decide(decision, decision === "changes_asked" ? note.trim() || null : null);
      if (result.ok) {
        setDone(decision);
        setOpen(false);
      } else setProblem(result.problem);
    } catch {
      setProblem(C.failed);
    } finally {
      setWorking(false);
    }
  }

  if (done === "approved") {
    return (
      <div data-approval-review="approved" className="flex flex-col gap-1 text-(length:--type-small)">
        <p className="font-medium text-foreground">{C.approved("you")}</p>
        <p className="text-muted-foreground">{C.textLater(leadName)}</p>
      </div>
    );
  }
  if (done === "changes_asked") {
    return (
      <p data-approval-review="changes_asked" className="text-(length:--type-small) text-foreground">
        {C.changesAsked("You", note.trim() || null)}
      </p>
    );
  }

  const marker = step === "changes" ? null : STEP_CARD_COPY.stepOf(step === "final" ? 1 : 2, 2);
  return (
    <div data-approval-review="waiting" data-proposal={proposalId} className="flex flex-col gap-2 text-(length:--type-small)">
      <p className="break-words font-medium text-foreground [overflow-wrap:anywhere]">{C.request(lead, approval.finalTitle)}</p>
      {approval.stale ? <p className="text-foreground">{C.stale(lead)}</p> : null}
      <Button
        type="button"
        size="sm"
        className="self-start"
        onClick={() => {
          // Back where the admin left it (the note is kept too), unless this is a new request: then the final first.
          if (seenRequest.current !== approval.id) {
            seenRequest.current = approval.id;
            setStep("final");
            setDoc(null);
          }
          setDirection("forward");
          setOpen(true);
        }}
        data-approval-open=""
      >
        {K.review}
      </Button>
      <StepCard
        open={open}
        onOpenChange={setOpen}
        stepKey={step}
        direction={direction}
        marker={marker}
        title={step === "final" ? K.finalTitle(first) : step === "approve" ? K.approveTitle(first) : C.askChanges}
        intro={step === "final" ? approval.finalTitle || null : step === "approve" ? K.approveIntro : K.changesIntro(first)}
        onBack={step === "final" || working ? null : () => go("final")}
        busy={working}
        onReopen={() => setOpen(true)}
        cardKey={`approval:${proposalId}`}
        testId="approval-card"
        footer={
          step === "final" ? (
            <>
              <Button type="button" variant="ghost" onClick={() => go("changes")}>
                {K.askChanges(first)}
              </Button>
              <Button type="button" disabled={approval.stale} onClick={() => go("approve")} data-flow-primary="">
                {K.next}
              </Button>
            </>
          ) : step === "approve" ? (
            <Button type="button" disabled={working || approval.stale} onClick={() => void press("approved")} data-flow-primary="">
              {working ? C.sending : C.approve}
            </Button>
          ) : (
            <Button type="button" disabled={working} onClick={() => void press("changes_asked")} data-flow-primary="">
              {working ? C.sending : C.sendNote}
            </Button>
          )
        }
      >
        {step === "final" ? (
          <>
            {approval.stale ? <p className="flow-note">{C.stale(lead)}</p> : null}
            {doc === null ? (
              <p className="flow-note" role="status">
                {K.finalLoading}
              </p>
            ) : doc.ok ? (
              <div className="lead-doc-page" data-approval-final="">
                {doc.text}
              </div>
            ) : (
              <p role="alert" className="flow-problem">
                {doc.problem}
              </p>
            )}
          </>
        ) : step === "approve" ? (
          <dl className="flow-done">
            <dt>{K.moves}</dt>
            <dd>{C.stage.client_review}</dd>
            <dt>{K.tells(first)}</dt>
            <dd>{C.textLater(lead)}</dd>
          </dl>
        ) : (
          <Textarea aria-label={C.note} placeholder={C.note} rows={3} maxLength={APPROVAL_NOTE_MAX} value={note} onChange={(event) => setNote(event.target.value)} />
        )}
        {problem ? (
          <p role="alert" className="flow-problem">
            {problem}
          </p>
        ) : null}
      </StepCard>
    </div>
  );
}

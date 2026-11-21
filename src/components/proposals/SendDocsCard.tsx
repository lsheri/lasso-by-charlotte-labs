import { useState } from "react";

import { Button } from "@/components/ui/button";
import { PersonFace } from "@/components/ui/person-face";
import { StepCard } from "@/components/ui/step-card";
import { FileText } from "@/design/brand/icons";
import { SEND_DOCS_COPY, type SendDocsResult } from "@/lib/lead-view-shared";
import { firstWord, FLOW_COPY } from "@/lib/proposal-flow-shared";

import "./proposal-flow.css";

/** Exactly who the documents go to, and exactly which ones: the picture before the Send button. */
export function SendDocsPicture({ leadName, titles, count }: { leadName: string; titles: readonly string[]; count: number }) {
  return (
    <div className="flow-send" data-send-picture="">
      <span className="flow-label">{FLOW_COPY.send.to}</span>
      <div className="flow-person" data-flow-to="">
        <PersonFace name={leadName} />
        <b>{leadName}</b>
      </div>
      <span className="flow-label">{FLOW_COPY.send.goes(titles.length || count)}</span>
      {titles.length ? (
        <ul className="flow-tiles">
          {titles.map((title, i) => (
            <li key={`${title}-${i}`} className="flow-tile">
              <FileText aria-hidden className="size-5" />
              <span>{title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="flow-note">{FLOW_COPY.send.countOnly(count)}</p>
      )}
    </div>
  );
}

/**
 * 21 Nov 2026, click path cards: "Send Christy the documents" on a proposal's row opens this card, which shows who
 * and what before anything is shared, then sends through the row's own call. A refused send keeps the card open and
 * says why.
 */
export function SendDocsCard({
  open,
  onOpenChange,
  leadName,
  titles,
  count,
  onSend,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  /** The documents not shared yet, by title, when the row has them. */
  titles: readonly string[];
  count: number;
  onSend: (send: boolean) => Promise<SendDocsResult>;
}) {
  const first = firstWord(leadName);
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function send() {
    if (working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await onSend(true);
      if (!result.ok) setProblem(result.problem);
      else onOpenChange(false);
    } catch {
      setProblem(SEND_DOCS_COPY.failed);
    } finally {
      setWorking(false);
    }
  }
  return (
    <StepCard
      open={open}
      onOpenChange={onOpenChange}
      stepKey="send"
      title={FLOW_COPY.send.title(first)}
      intro={SEND_DOCS_COPY.what(first)}
      busy={working}
      testId="send-docs-card"
      footer={
        <>
          <Button type="button" variant="ghost" disabled={working} onClick={() => onOpenChange(false)}>
            {FLOW_COPY.send.later}
          </Button>
          <Button type="button" data-flow-primary="" disabled={working} onClick={() => void send()}>
            {working ? SEND_DOCS_COPY.working : FLOW_COPY.send.send}
          </Button>
        </>
      }
    >
      <SendDocsPicture leadName={leadName} titles={titles} count={count} />
      {problem ? (
        <p role="alert" className="flow-problem">
          {problem}
        </p>
      ) : null}
    </StepCard>
  );
}

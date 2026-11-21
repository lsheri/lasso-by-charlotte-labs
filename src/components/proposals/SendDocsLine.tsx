import { useState } from "react";

import { Button } from "@/components/ui/button";
import { SEND_DOCS_COPY, type SendDocsResult } from "@/lib/lead-view-shared";

/**
 * 21 Nov 2026, chat pill PR 4b (D-97): on the proposal's own row, for the person who started it, once a lead is
 * picked. "Send Christy the documents" lets that lead open them on their Home; nothing is texted or emailed, and
 * nobody else is given them. "Stop sharing" takes it back. A lead with no login is told plainly why nothing can go.
 */
export function SendDocsLine({
  state,
  leadName,
  hasDocs,
  added = 1,
  onSend,
}: {
  state: "sent" | "more" | "unsent" | "no_login";
  leadName: string;
  /** The proposal has documents to send. */
  hasDocs: boolean;
  /** How many documents were added since the send ("more" only). */
  added?: number | undefined;
  onSend: (send: boolean) => Promise<SendDocsResult>;
}) {
  const C = SEND_DOCS_COPY;
  const first = leadName.trim().split(/\s+/)[0] ?? "";
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  async function press(send: boolean) {
    if (working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await onSend(send);
      if (!result.ok) setProblem(result.problem);
    } catch {
      setProblem(C.failed);
    } finally {
      setWorking(false);
    }
  }
  if (state === "no_login") {
    return hasDocs ? (
      <p data-send-docs="no_login" className="text-(length:--type-small) text-muted-foreground">
        {C.noLogin(first)}
      </p>
    ) : null;
  }
  if (!hasDocs && state === "unsent") return null;
  return (
    <div data-send-docs={state} className="flex flex-col gap-1 text-(length:--type-small)">
      {state === "more" ? (
        <>
          <p className="text-foreground">{C.more(first, added)}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button type="button" size="sm" variant="outline" className="h-auto min-h-8 whitespace-normal text-left" disabled={working} onClick={() => void press(true)}>
              {working ? C.working : C.sendNew(first)}
            </Button>
            <button type="button" className="text-muted-foreground underline hover:text-foreground disabled:opacity-50" disabled={working} onClick={() => void press(false)}>
              {C.stop}
            </button>
          </div>
        </>
      ) : state === "sent" ? (
        <p className="flex flex-wrap items-center gap-x-2 text-foreground">
          <span>{C.sent(first)}</span>
          <button type="button" className="text-muted-foreground underline hover:text-foreground disabled:opacity-50" disabled={working} onClick={() => void press(false)}>
            {working ? C.working : C.stop}
          </button>
        </p>
      ) : (
        <>
          <Button type="button" size="sm" variant="outline" className="h-auto min-h-8 self-start whitespace-normal text-left" disabled={working} onClick={() => void press(true)} title={C.what(first)}>
            {working ? C.working : C.send(first)}
          </Button>
          <p className="text-muted-foreground">{C.what(first)}</p>
        </>
      )}
      {problem ? (
        <p role="alert" className="text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}

import { useState } from "react";

import { LeadDocumentDialog } from "@/components/home/LeadDocumentDialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { APPROVAL_COPY, APPROVAL_NOTE_MAX, type ApprovalResult, type ApprovalView } from "@/lib/proposal-approval-shared";
import type { LeadDocResult } from "@/lib/lead-view-shared";

/**
 * 21 Nov 2026, chat pill Phase 5 (D-97): on a Proposals row, for an admin, the Lead's request: open the final, then
 * Approve or Ask for changes with one short note. Approving marks it as gone to the client; the line says the Lead
 * gets a text only once texts are approved. The server decides who may: an admin who leads it is told a second admin
 * approves.
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
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<"approved" | "changes_asked" | null>(null);
  const [reading, setReading] = useState(false);
  async function press(decision: "approved" | "changes_asked") {
    if (working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await decide(decision, decision === "changes_asked" ? note.trim() || null : null);
      if (result.ok) setDone(decision);
      else setProblem(result.problem);
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
  return (
    <div data-approval-review="waiting" className="flex flex-col gap-2 text-(length:--type-small)">
      <p className="break-words font-medium text-foreground [overflow-wrap:anywhere]">{C.request(approval.requestedBy || leadName, approval.finalTitle)}</p>
      {approval.stale ? <p className="text-foreground">{C.stale(approval.requestedBy || leadName)}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={() => setReading(true)}>
          {C.openFinal}
        </Button>
        <Button type="button" size="sm" disabled={working || approval.stale} onClick={() => void press("approved")}>
          {C.approve}
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={working} onClick={() => setAsking((open) => !open)}>
          {C.askChanges}
        </Button>
      </div>
      {asking ? (
        <div className="flex flex-col gap-2">
          <Textarea aria-label={C.note} placeholder={C.note} rows={2} maxLength={APPROVAL_NOTE_MAX} value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={working} onClick={() => void press("changes_asked")}>
              {C.sendNote}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setAsking(false)}>
              {C.cancel}
            </Button>
          </div>
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="text-destructive">
          {problem}
        </p>
      ) : null}
      <LeadDocumentDialog
        open={reading ? { proposalId, itemId: approval.finalItemId, title: approval.finalTitle } : null}
        read={async () => {
          const result = await readFinal();
          return (result.ok ? { ok: true, title: result.title, text: result.text, withheld: false } : result) as LeadDocResult;
        }}
        onClose={() => setReading(false)}
      />
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { useRef } from "react";

import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/ui/step-card";
import { LEAD_DOC_CARD_COPY, LEAD_VIEW_COPY, type LeadDocResult } from "@/lib/lead-view-shared";

import "@/components/proposals/proposal-flow.css";

/**
 * 21 Nov 2026, chat pill PR 4b: one document a proposal's owner sent to its Lead, read as text through the server,
 * which checks again that this person still leads it. Amounts are withheld for a Member, and the dialog says so.
 */
export function LeadDocumentDialog({
  open,
  read,
  onClose,
  onReopen,
}: {
  /** The proposal and document to show, with the title the list already has. Null when closed. */
  open: { proposalId: string; itemId: string; title: string } | null;
  read: (proposalId: string, itemId: string) => Promise<LeadDocResult>;
  onClose: () => void;
  /** Opens the same document again, for the chat's way back after "Ask Lasso about this". */
  onReopen?: (() => void) | undefined;
}) {
  const doc = useQuery({
    queryKey: ["lead-document", open?.proposalId ?? null, open?.itemId ?? null],
    enabled: Boolean(open),
    retry: false,
    staleTime: 0,
    queryFn: () => read(open!.proposalId, open!.itemId),
  });
  const result = doc.data;
  // 21 Nov 2026, click path cards: the document on a step card, as a page, front and centre. The card keeps drawing
  // the last document while it plays its way out.
  const last = useRef(open);
  if (open) last.current = open;
  const shown = open ?? last.current;
  return (
    <StepCard
      open={open !== null}
      onOpenChange={(next) => (next ? null : onClose())}
      stepKey={shown ? `${shown.proposalId}:${shown.itemId}` : "doc"}
      title={result?.ok ? result.title : (shown?.title ?? "")}
      intro={doc.isLoading ? LEAD_VIEW_COPY.docLoading : result?.ok && result.withheld ? LEAD_VIEW_COPY.withheld : null}
      onReopen={onReopen}
      testId="lead-document"
      footer={
        <Button type="button" onClick={onClose}>
          {LEAD_DOC_CARD_COPY.done}
        </Button>
      }
    >
      {doc.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {LEAD_VIEW_COPY.docFailed}
        </p>
      ) : result && !result.ok ? (
        <p role="alert" className="text-sm text-foreground">
          {result.problem}
        </p>
      ) : result?.ok ? (
        <div data-lead-document-text className="lead-doc-page">
          {result.text}
        </div>
      ) : null}
    </StepCard>
  );
}

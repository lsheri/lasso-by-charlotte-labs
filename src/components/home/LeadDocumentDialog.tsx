import { useQuery } from "@tanstack/react-query";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEAD_VIEW_COPY, type LeadDocResult } from "@/lib/lead-view-shared";

/**
 * 21 Nov 2026, chat pill PR 4b: one document a proposal's owner sent to its Lead, read as text through the server,
 * which checks again that this person still leads it. Amounts are withheld for a Member, and the dialog says so.
 */
export function LeadDocumentDialog({
  open,
  read,
  onClose,
}: {
  /** The proposal and document to show, with the title the list already has. Null when closed. */
  open: { proposalId: string; itemId: string; title: string } | null;
  read: (proposalId: string, itemId: string) => Promise<LeadDocResult>;
  onClose: () => void;
}) {
  const doc = useQuery({
    queryKey: ["lead-document", open?.proposalId ?? null, open?.itemId ?? null],
    enabled: Boolean(open),
    retry: false,
    staleTime: 0,
    queryFn: () => read(open!.proposalId, open!.itemId),
  });
  const result = doc.data;
  return (
    <Dialog open={open !== null} onOpenChange={(next) => (next ? null : onClose())}>
      <DialogContent data-testid="lead-document" className="max-h-[85dvh] grid-cols-[minmax(0,1fr)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="break-words [overflow-wrap:anywhere]">{result?.ok ? result.title : (open?.title ?? "")}</DialogTitle>
          <DialogDescription>
            {doc.isLoading ? LEAD_VIEW_COPY.docLoading : result?.ok && result.withheld ? LEAD_VIEW_COPY.withheld : ""}
          </DialogDescription>
        </DialogHeader>
        {doc.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {LEAD_VIEW_COPY.docFailed}
          </p>
        ) : result && !result.ok ? (
          <p role="alert" className="text-sm text-foreground">
            {result.problem}
          </p>
        ) : result?.ok ? (
          <div data-lead-document-text className="whitespace-pre-wrap break-words text-sm text-foreground [overflow-wrap:anywhere]">
            {result.text}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

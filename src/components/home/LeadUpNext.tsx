import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { type FinalTools } from "@/components/home/LeadFinalBlock";
import { LeadFinalCard } from "@/components/home/LeadFinalCard";
import { useCaptureFiles } from "@/components/work/use-capture-files";
import { chooseFinalFn, draftFinalFn } from "@/lib/proposal-final.functions";

import { LeadDocumentDialog } from "@/components/home/LeadDocumentDialog";
import { useLed } from "@/components/home/use-led";
import { deskDate } from "@/lib/proposal-desk-shared";
import { LEAD_VIEW_COPY, timeLeft, timeLeftLine, upNextOrder, type LeadDocResult, type LedList, type LedProposal } from "@/lib/lead-view-shared";
import { leadDocumentFn } from "@/lib/lead-view.functions";

/**
 * 21 Nov 2026, chat pill PR 4b (D-97): Up next on Home for a proposal's Lead. Shows only for someone who leads an
 * open proposal; for everyone else it renders nothing, so Home is unchanged. The data is the server's
 * (lead-view.server.ts), which decides what this person may see.
 */
export function LeadUpNext({ profileId }: { profileId: string | null | undefined }) {
  const led = useLed(profileId);
  const [open, setOpen] = useState<{ proposalId: string; itemId: string; title: string } | null>(null);
  const queryClient = useQueryClient();
  const { captureWithResult } = useCaptureFiles();
  // PR 4c: deciding the final proposal, through the server's own checks.
  const finalTools: FinalTools = {
    choose: async (proposalId, itemId, source) => {
      const result = await chooseFinalFn({ data: { profile_id: profileId ?? null, proposal_id: proposalId, work_item_id: itemId, source } });
      if (result.ok) void queryClient.invalidateQueries({ queryKey: ["lead-view"] });
      return result;
    },
    draft: (proposalId) => draftFinalFn({ data: { profile_id: profileId ?? null, proposal_id: proposalId } }),
    upload: (files) => captureWithResult(files, { channel: "upload" }),
  };
  if (!profileId) return null;
  // QA L2 of PR 299: a failed read says nothing to someone not known to lead anything, so nobody else's Home
  // changes on a bad day. A lead whose list is already here keeps it, with one quiet line.
  if (!led.data || led.data.proposals.length === 0) return null;
  return (
    <>
      <LeadUpNextList data={led.data} onOpen={setOpen} finalTools={finalTools} />
      {led.isError ? (
        <p data-testid="lead-up-next-stale" className="mx-auto w-full max-w-[760px] px-4 pt-2 text-(length:--type-small) text-muted-foreground md:px-6">
          {LEAD_VIEW_COPY.stale}{" "}
          <button type="button" className="underline" onClick={() => void led.refetch()}>
            {LEAD_VIEW_COPY.retry}
          </button>
        </p>
      ) : null}
      <LeadDocumentDialog
        open={open}
        read={(proposalId, itemId) => leadDocumentFn({ data: { profile_id: profileId, proposal_id: proposalId, work_item_id: itemId } }) as Promise<LeadDocResult>}
        onClose={() => setOpen(null)}
      />
    </>
  );
}

/** The list itself, from plain values, so it renders in a test. */
export function LeadUpNextList({
  data,
  now,
  onOpen,
  finalTools,
}: {
  data: LedList;
  now?: Date | undefined;
  onOpen: (doc: { proposalId: string; itemId: string; title: string }) => void;
  /** PR 4c: deciding the final proposal. Left out, the block is not drawn. */
  finalTools?: FinalTools | undefined;
}) {
  const C = LEAD_VIEW_COPY;
  const rows = upNextOrder(data.proposals, data.goalHours, now);
  return (
    <section data-testid="lead-up-next" aria-labelledby="lead-up-next-title" className="mx-auto flex w-full max-w-[760px] flex-col gap-3 px-4 pt-6 md:px-6">
      <div className="flex flex-col gap-1">
        <h2 id="lead-up-next-title" className="text-(length:--type-label) font-medium uppercase tracking-[0.08em] text-muted-foreground">
          {C.title}
        </h2>
        <p className="text-(length:--type-small) text-muted-foreground">{C.intro(rows.length)}</p>
      </div>
      <ul className="divide-y divide-border border-y border-border">
        {rows.map((row, index) => (
          <LedRow key={row.id} row={row} first={index === 0} goalHours={data.goalHours} now={now} onOpen={onOpen} finalTools={finalTools} />
        ))}
      </ul>
    </section>
  );
}

function LedRow({
  row,
  first,
  goalHours,
  now,
  onOpen,
  finalTools,
}: {
  finalTools?: FinalTools | undefined;
  row: LedProposal;
  first: boolean;
  goalHours: number;
  now?: Date | undefined;
  onOpen: (doc: { proposalId: string; itemId: string; title: string }) => void;
}) {
  const C = LEAD_VIEW_COPY;
  const left = timeLeft({ receivedAt: row.receivedAt, sentAt: row.sentAt, goalHours, now });
  return (
    <li data-led-proposal={row.id} data-up-next={first ? "" : undefined} className="flex flex-col gap-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <p className="break-words font-medium text-foreground [overflow-wrap:anywhere]">{row.title}</p>
          <p className="break-words text-(length:--type-small) text-muted-foreground [overflow-wrap:anywhere]">
            {[row.clientName ? C.for(row.clientName) : "", row.ownerName ? C.startedBy(row.ownerName) : ""].filter(Boolean).join(". ")}
          </p>
        </div>
        <p data-led-clock={left.state} className="shrink-0 font-mono text-(length:--type-label) text-muted-foreground">
          {timeLeftLine(left, goalHours)}
        </p>
      </div>
      {row.dueOn ? <p className="text-(length:--type-small) text-foreground">{C.due(deskDate(row.dueOn, now))}</p> : null}
      <details open={first} className="text-(length:--type-small)">
        <summary className="cursor-pointer font-medium text-foreground">{C.brief}</summary>
        <p data-led-brief className="mt-2 whitespace-pre-wrap break-words text-foreground [overflow-wrap:anywhere]">
          {row.brief ?? C.noBrief}
        </p>
      </details>
      <div className="flex flex-col gap-1 text-(length:--type-small)">
        <p className="font-medium text-foreground">{C.documents}</p>
        {row.documents === null ? (
          <p data-led-docs="waiting" className="text-muted-foreground">
            {row.documentCount === 0 ? C.noDocuments : C.notSent(row.documentCount, row.ownerName)}
          </p>
        ) : row.documents.length === 0 ? (
          <p data-led-docs="none" className="text-muted-foreground">{C.noDocuments}</p>
        ) : (
          <ul data-led-docs="sent" className="flex flex-col gap-1">
            {row.documents.map((doc) => (
              <li key={doc.id}>
                <button
                  type="button"
                  aria-label={C.open(doc.title)}
                  className="break-words text-left text-foreground underline underline-offset-2 [overflow-wrap:anywhere] hover:text-muted-foreground"
                  onClick={() => onOpen({ proposalId: row.id, itemId: doc.id, title: doc.title })}
                >
                  {doc.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {finalTools ? <LeadFinalCard proposalId={row.id} client={row.clientName ?? ""} final={row.final} documents={row.documents ?? []} tools={finalTools} now={now} /> : null}
      <div className="flex flex-col gap-1 text-(length:--type-small)">
        <p className="font-medium text-foreground">{C.pastWork}</p>
        <p data-led-past className="break-words text-muted-foreground [overflow-wrap:anywhere]">
          {row.pastWork.length ? row.pastWork.map((work) => work.title).join("; ") : C.noPastWork}
        </p>
      </div>
    </li>
  );
}

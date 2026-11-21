import { useState } from "react";

import { Button } from "@/components/ui/button";
import { StepCard } from "@/components/ui/step-card";
import { deskDate } from "@/lib/proposal-desk-shared";
import { FINAL_COPY, FINAL_CARD_COPY, type FinalView } from "@/lib/proposal-final-shared";

import { LeadFinalBlock, type FinalTools } from "./LeadFinalBlock";

/**
 * 21 Nov 2026, click path cards: the Lead's "Decide the final" on Home opens a step card holding the final block
 * (upload it, draft it from the brief, or use a document that was sent), so the choice gets the whole stage. The row
 * keeps one line saying where things are. Every press is the block's own, through the server's checks.
 */
export function LeadFinalCard({
  proposalId,
  client,
  final,
  documents,
  tools,
  now,
}: {
  proposalId: string;
  client: string;
  final: FinalView | null | undefined;
  documents: readonly { id: string; title: string }[];
  tools: FinalTools;
  now?: Date | undefined;
}) {
  const [open, setOpen] = useState(false);
  const C = FINAL_COPY;
  return (
    <div data-led-final-row={final?.gone ? "gone" : final ? "chosen" : "none"} className="flex flex-col gap-2 text-(length:--type-small)">
      <p className="font-medium text-foreground">{C.heading}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]">
          {final?.gone ? C.gone(deskDate(final.chosenAt, now)) : final ? C.chosen(final.title || "Untitled", deskDate(final.chosenAt, now)) : FINAL_CARD_COPY.notYet}
        </p>
        <Button type="button" size="sm" variant={final && !final.gone ? "outline" : "default"} onClick={() => setOpen(true)} data-led-final-open="">
          {final && !final.gone ? FINAL_CARD_COPY.change : FINAL_CARD_COPY.decide}
        </Button>
      </div>
      <StepCard
        open={open}
        onOpenChange={setOpen}
        stepKey="final"
        title={FINAL_CARD_COPY.title}
        intro={client ? FINAL_CARD_COPY.intro(client) : null}
        testId="lead-final-card"
        footer={
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            {FINAL_CARD_COPY.close}
          </Button>
        }
      >
        <LeadFinalBlock proposalId={proposalId} final={final} documents={documents} tools={tools} now={now} />
      </StepCard>
    </div>
  );
}

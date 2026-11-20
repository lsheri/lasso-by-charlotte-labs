import { useEffect, useState } from "react";

import { MessageExamples } from "@/components/proposals/MessageExamples";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { tagVariants } from "@/components/ui/tag";
import { LEAD_COPY, type DeskProposal, type LeadResult } from "@/lib/proposal-desk-shared";
import { ROSTER_COPY, type RosterContact } from "@/lib/roster-shared";

/** One line under an open proposal: who the lead is and whether they agreed to texts. Admins and leads only. */
export function LeadLine({ lead, picked, onPick }: { lead: RosterContact | undefined; picked: boolean; onPick: () => void }) {
  return (
    <p data-proposal-lead className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
      <span>{lead ? LEAD_COPY.lead(lead.name) : LEAD_COPY.none}</span>
      {lead ? <span className={tagVariants({ tone: lead.texts === "agreed" ? "accent" : "outline" })}>{ROSTER_COPY.texts[lead.texts]}</span> : null}
      <button type="button" className="underline hover:text-foreground" onClick={onPick}>
        {lead || picked ? LEAD_COPY.change : LEAD_COPY.pick}
      </button>
    </p>
  );
}

/**
 * 20 Nov 2026 (Liam): pick the lead for a proposal from "People we work with", and see the message as it will
 * arrive. Says plainly whether the person agreed to texts: no agreement, no text. Saving the pick sends nothing.
 * No phone number is ever on this page.
 */
export function LeadDialog({
  proposal,
  roster,
  words,
  onClose,
  onSave,
}: {
  proposal: DeskProposal | null;
  /** Undefined while the list loads or when it could not be read. */
  roster: RosterContact[] | undefined;
  /** The won text, exactly as it is sent. */
  words: string;
  onClose: () => void;
  onSave: (proposalId: string, contactId: string | null) => Promise<LeadResult>;
}) {
  const copy = LEAD_COPY;
  const [choice, setChoice] = useState("");
  const [working, setWorking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const proposalId = proposal?.id ?? null;
  const current = proposal?.leadContactId ?? "";

  useEffect(() => {
    setChoice(current);
    setProblem(null);
  }, [proposalId, current]);

  const people = roster ?? [];
  const chosen = people.find((person) => person.id === choice);

  async function save(contactId: string | null) {
    if (!proposal || working) return;
    setWorking(true);
    setProblem(null);
    try {
      const result = await onSave(proposal.id, contactId);
      if (result.ok) onClose();
      else setProblem(result.problem);
    } catch {
      setProblem(copy.failed);
    } finally {
      setWorking(false);
    }
  }

  return (
    <Dialog
      open={proposal !== null}
      onOpenChange={(next) => {
        if (next || working) return;
        onClose();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" data-testid="pick-lead">
        <DialogHeader>
          <DialogTitle className="page-title">{copy.title}</DialogTitle>
          <DialogDescription>{copy.intro}</DialogDescription>
        </DialogHeader>
        {roster !== undefined && people.length === 0 ? (
          <p className="text-sm text-muted-foreground">{copy.noPeople}</p>
        ) : (
          <NativeSelect aria-label={copy.select} value={choice} disabled={working || roster === undefined} onChange={(event) => { setChoice(event.target.value); setProblem(null); }}>
            <option value="">{copy.select}</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.role ? `${person.name}, ${person.role}` : person.name}
              </option>
            ))}
          </NativeSelect>
        )}
        {chosen ? (
          <p data-lead-texts={chosen.texts} className="text-sm text-foreground">
            {chosen.texts === "agreed" ? copy.agreed(chosen.name) : chosen.texts === "unknown" ? copy.unknown(chosen.name) : copy.notAgreed(chosen.name)}
          </p>
        ) : null}
        <div className="space-y-2 text-(length:--type-small)">
          <p className="micro-label">{copy.preview}</p>
          <MessageExamples words={words} />
        </div>
        {problem ? (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" disabled={working} onClick={onClose}>
            {copy.cancel}
          </Button>
          {current ? (
            <Button type="button" variant="outline" disabled={working} onClick={() => void save(null)}>
              {copy.clear}
            </Button>
          ) : null}
          <Button type="button" disabled={working || !choice || choice === current} onClick={() => void save(choice)}>
            {working ? copy.saving : copy.save}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

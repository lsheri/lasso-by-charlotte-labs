import { useEffect, useState } from "react";

import { MessageExamples } from "@/components/proposals/MessageExamples";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PersonFace } from "@/components/ui/person-face";
import { tagVariants } from "@/components/ui/tag";
import { useBackCloses } from "@/hooks/use-back-closes";
import { LEAD_COPY, type DeskProposal, type LeadResult } from "@/lib/proposal-desk-shared";
import { ROSTER_COPY, type RosterContact } from "@/lib/roster-shared";
import { cn } from "@/lib/utils";

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
 * 20 Nov 2026 (Liam): pick the lead for a proposal from "People we work with", as rows you can see (a face, a role, whether they agreed to texts),
 * and see the message as it will read, in the device it arrives on. Says plainly whether the person agreed to texts, and where a text would go: saving the pick sends nothing; a real
 * workspace texts the person picked once they have agreed, and a demo workspace texts its demo number.
 * No phone number is ever on this page.
 */
export function LeadDialog({
  proposal,
  roster,
  words,
  demo,
  onClose,
  onSave,
}: {
  /** A demo workspace: its texts go to the demo number, not to the person picked. */
  demo?: boolean | undefined;
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

  // On a phone, Back closes the dialog and stays on the page.
  useBackCloses(proposal !== null, onClose);

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
          <div role="radiogroup" aria-label={copy.select} data-lead-people className="-m-1 flex max-h-64 flex-col gap-1 overflow-y-auto p-1">
            {people.map((person) => {
              const on = person.id === choice;
              return (
                <button
                  key={person.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-lead-person={person.id}
                  disabled={working}
                  className={cn(
                    "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-(--corner-panel) border px-3 py-2 text-left disabled:opacity-50",
                    on ? "border-[var(--action-edge)] bg-[var(--action-wash)]" : "border-transparent hover:bg-muted",
                  )}
                  onClick={() => { setChoice(person.id); setProblem(null); }}
                >
                  <PersonFace name={person.name} />
                  <span className="min-w-[6.5rem] flex-1">
                    <span className="block break-words text-(length:--type-control) font-medium text-foreground [overflow-wrap:anywhere]">{person.name}</span>
                    {person.role ? <span className="block break-words text-(length:--type-small) text-muted-foreground [overflow-wrap:anywhere]">{person.role}</span> : null}
                  </span>
                  <span className={cn(tagVariants({ tone: person.texts === "agreed" ? "accent" : "outline" }), "ms-auto shrink-0")}>{ROSTER_COPY.texts[person.texts]}</span>
                </button>
              );
            })}
          </div>
        )}
        {chosen ? (
          <p data-lead-texts={chosen.texts} className="text-sm text-foreground">
            {chosen.texts === "agreed" ? copy.agreed(chosen.name) : chosen.texts === "unknown" ? copy.unknown(chosen.name) : copy.notAgreed(chosen.name)}
          </p>
        ) : null}
        <p data-lead-today className="text-sm text-muted-foreground">
          {copy.where(Boolean(demo))}
        </p>
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

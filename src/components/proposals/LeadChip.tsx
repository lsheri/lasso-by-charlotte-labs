import { PersonFace } from "@/components/ui/person-face";
import { tagVariants } from "@/components/ui/tag";
import { LEAD_COPY, SPACE_COPY, type AskWord } from "@/lib/proposal-desk-shared";
import { ROSTER_COPY, type RosterTexts } from "@/lib/roster-shared";
import { cn } from "@/lib/utils";

/** The dot on the face: hollow while asked, lime for a yes, ink for a no. Nothing for the rest. */
const DOT: Partial<Record<AskWord, string>> = {
  asked: "bg-card ring-[1.5px] ring-muted-foreground",
  practice: "bg-card ring-[1.5px] ring-muted-foreground",
  yes: "bg-[var(--good-mark)] ring-[1.3px] ring-foreground",
  no: "bg-foreground",
};

/**
 * 20 Nov 2026 (Liam, D-86, the design review's "a person is a face, a name and a dot"): the lead on a proposal as one
 * chip. With no lead, a dashed chip that picks one. With a lead: their face with a dot for the ask, their name, and
 * one pill, the ask in a word once they have been asked, else whether they agreed to texts. Change sits beside it.
 * Never a number, a score or how long anyone took.
 */
export function LeadChip({
  name,
  texts,
  ask,
  picked = false,
  onPick,
}: {
  /** The lead's name; undefined when none is picked. */
  name: string | undefined;
  /** Whether they agreed to texts. Only admins and leads have the roster, so only they pass it. */
  texts?: RosterTexts | undefined;
  ask: AskWord | null;
  /** A lead is saved, but their name is not on the list this person has (it is loading, or they left it). */
  picked?: boolean | undefined;
  /** Pick or change the lead. Left out, the chip only reads. */
  onPick?: (() => void) | undefined;
}) {
  if (!name) {
    if (!onPick) return null;
    if (picked) {
      return (
        <p data-proposal-lead className="flex flex-wrap items-center gap-x-2 text-(length:--type-small) text-muted-foreground">
          <span>{LEAD_COPY.none}</span>
          <button type="button" className="underline hover:text-foreground" onClick={onPick}>
            {LEAD_COPY.change}
          </button>
        </p>
      );
    }
    return (
      <p data-proposal-lead className="flex">
        <button
          type="button"
          onClick={onPick}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-muted-foreground px-3 text-(length:--type-small) font-medium text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        >
          <span aria-hidden="true">+</span>
          {LEAD_COPY.pick}
        </button>
      </p>
    );
  }
  const dot = ask ? DOT[ask] : undefined;
  // A practice ask already carries its own Practice tag on the line beneath, so the chip shows only the dot.
  const pill = ask === "practice" ? null : ask ? SPACE_COPY.ask[ask] : texts ? ROSTER_COPY.texts[texts] : null;
  const good = ask === "yes" || (!ask && texts === "agreed");
  return (
    <p data-proposal-lead data-lead-ask={ask ?? "none"} className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <span className="relative shrink-0">
        <PersonFace name={name} size="sm" />
        {dot ? <span aria-hidden="true" data-lead-dot={ask} className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-offset-0", dot)} /> : null}
      </span>
      <span className="min-w-0 break-words text-(length:--type-small) font-semibold text-foreground [overflow-wrap:anywhere]">
        <span className="sr-only">{SPACE_COPY.leadLabel} </span>
        {name}
      </span>
      {pill ? (
        <span data-lead-pill className={cn(tagVariants({ tone: good ? "accent" : "outline" }), good && ask === "yes" ? "bg-[var(--good-tint)] text-foreground" : null)}>
          {pill}
        </span>
      ) : null}
      {onPick ? (
        <button type="button" className="text-(length:--type-small) text-muted-foreground underline hover:text-foreground" onClick={onPick}>
          {LEAD_COPY.change}
        </button>
      ) : null}
    </p>
  );
}

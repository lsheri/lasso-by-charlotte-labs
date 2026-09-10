import { useCoachLinkPeople } from "@/hooks/use-coaching-links";
import { COACHING_COPY } from "@/lib/coaching-access";

/**
 * PASS 170 — the people a coach is linked to, person to person.
 *
 * A link nobody has agreed to yet is not here at all, in either direction. When
 * a link ends, for any reason, the coach reads the same short line: access
 * ended. No reason is ever shown, and no count of anything is shown to anyone.
 */
export function CoachLinkPeople() {
  const { data } = useCoachLinkPeople();
  const people = (data ?? []).filter((person) => person.state !== "pending");
  if (people.length === 0) return null;

  return (
    <section className="mb-6 space-y-2" aria-label="People linked to you">
      {people.map((person) => {
        const over = person.state === "ended" || person.state === "withdrawn";
        return (
          <div
            key={person.link_id}
            className="rounded-[var(--radius-control)] border border-[var(--nb-pencil)] bg-card px-5 py-4 shadow-card"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{person.subject_name}</p>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {person.relation === "manager" ? "Manager" : "Outside coach"}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {over
                ? COACHING_COPY.accessEndedBody
                : person.structural
                  ? "You see the shape of the work they map, with neutral labels in place of names."
                  : "You see the work they map, in full."}
            </p>
            {over ? (
              <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {COACHING_COPY.accessEnded}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

import { Button } from "@/components/ui/button";
import { useCoachingLinkAction, useMyCoachingLinks } from "@/hooks/use-coaching-links";
import { COACHING_COPY, accessSentence, relationSentence } from "@/lib/coaching-access";

/**
 * PASS 170 — what a person sees about coaching of their own work.
 *
 * A consent link asks a real question, with accept and decline as equals. A
 * firm policy link is told plainly and acknowledged once: it never stages a
 * question the product would not honour.
 */
export function CoachingLinkNotices() {
  const { data: links } = useMyCoachingLinks();
  const action = useCoachingLinkAction();
  const rows = links ?? [];

  const pending = rows.filter((row) => row.state === "pending");
  const toDisclose = rows.filter(
    (row) => row.basis === "firm_policy" && !row.disclosed_at && !row.ended_at,
  );
  const active = rows.filter((row) => row.state === "active" && row.basis === "subject_consent");

  if (pending.length === 0 && toDisclose.length === 0 && active.length === 0) return null;

  return (
    <section className="mb-6 space-y-3" aria-label="Coaching of your work">
      {pending.map((row) => (
        <div
          key={row.id}
          className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card"
        >
          <p className="micro-label">Coaching</p>
          <h2 className="mt-2 text-base font-medium text-foreground">
            {COACHING_COPY.pendingTitle}
          </h2>
          <p className="mt-1 text-sm text-foreground">{row.coach_name ?? "A colleague"}</p>
          <p className="mt-2 text-sm text-muted-foreground">{relationSentence(row)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{accessSentence(row)}</p>
          <p className="mt-2 text-sm text-muted-foreground">{COACHING_COPY.declineReassurance}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => action.mutate({ link: row, action: "consent" })}
              disabled={action.isPending}
            >
              {COACHING_COPY.pendingAccept}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => action.mutate({ link: row, action: "decline" })}
              disabled={action.isPending}
            >
              {COACHING_COPY.pendingDecline}
            </Button>
          </div>
        </div>
      ))}

      {toDisclose.map((row) => (
        <div
          key={row.id}
          className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card"
        >
          <p className="micro-label">Coaching</p>
          <h2 className="mt-2 text-base font-medium text-foreground">{COACHING_COPY.firmTitle}</h2>
          <p className="mt-1 text-sm text-foreground">{row.coach_name ?? "A colleague"}</p>
          <p className="mt-2 text-sm text-muted-foreground">{relationSentence(row)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{accessSentence(row)}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This was arranged by your firm under {row.agreement_ref ?? "its coaching agreement"}. You
            still choose what to map, and you can keep any single piece of work out of coaching.
          </p>
          <div className="mt-3">
            <Button
              type="button"
              onClick={() => action.mutate({ link: row, action: "disclose" })}
              disabled={action.isPending}
            >
              {COACHING_COPY.firmAcknowledge}
            </Button>
          </div>
        </div>
      ))}

      {active.map((row) => (
        <div
          key={row.id}
          className="rounded-[var(--radius)] border border-border bg-card px-5 py-3 shadow-card"
        >
          <p className="text-sm text-foreground">
            {row.coach_name ?? "A colleague"} sees the work you map.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{accessSentence(row)}</p>
          <div className="mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => action.mutate({ link: row, action: "withdraw" })}
              disabled={action.isPending}
            >
              {COACHING_COPY.withdrawLabel}
            </Button>
          </div>
        </div>
      ))}
    </section>
  );
}

import { Link } from "@tanstack/react-router";

import { useCoachSubjects } from "@/hooks/use-coaching";
import { useProfile } from "@/hooks/use-profile";

function sinceLabel(iso: string | null): string {
  if (!iso) return "No notes yet";
  return `Last note ${new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function CoachingPage() {
  const { data: profile } = useProfile();
  const { data: subjects, isLoading, error } = useCoachSubjects(profile?.id);

  return (
    <div>
      <header className="mb-8">
        <h1 className="page-title">People you coach</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The work each colleague has mapped and shared with you, most new material first.
        </p>
      </header>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? <p className="text-sm text-destructive">{(error as Error).message}</p> : null}

      <div className="space-y-2">
        {(subjects ?? []).map((subject) => (
          <Link
            key={`${subject.engagement_id}:${subject.subject_id}`}
            to="/coaching/$engagementId/$subjectId"
            params={{ engagementId: subject.engagement_id, subjectId: subject.subject_id }}
            className="block rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card transition-colors hover:bg-accent-soft"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{subject.subject_name}</p>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {subject.engagement_code}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{subject.engagement_title}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Count n={subject.new_decisions} noun="confirmed decision" />
              <Count n={subject.new_elements} noun="mapped work element" />
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {sinceLabel(subject.last_note_at)}
              </span>
            </div>
          </Link>
        ))}

        {subjects && subjects.length === 0 && !isLoading ? (
          <p className="text-sm text-muted-foreground">
            You&apos;ll see the people you coach here once an engagement owner adds you.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Count({ n, noun }: { n: number; noun: string }) {
  if (n === 0) return null;
  return (
    <span className="rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-[0.06em] text-accent-deep">
      {n} new {noun}
      {n === 1 ? "" : "s"}
    </span>
  );
}

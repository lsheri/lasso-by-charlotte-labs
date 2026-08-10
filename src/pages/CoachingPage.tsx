import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { EnterInviteCode } from "@/components/invites/EnterInviteCode";
import { useAllCoachSubjects } from "@/hooks/use-coaching";
import { setActiveProfileId, useProfile } from "@/hooks/use-profile";

function sinceLabel(iso: string | null): string {
  if (!iso) return "No notes yet";
  return `Last note ${new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}

export function CoachingPage() {
  const { profiles } = useProfile();
  const { data: subjects, isLoading, error } = useAllCoachSubjects(profiles);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const multiOrg = new Set(subjects.map((s) => s.coach_profile_id)).size > 1;

  function openPacket(coachProfileId: string, engagementId: string, subjectId: string) {
    setActiveProfileId(coachProfileId);
    void queryClient.invalidateQueries();
    navigate({
      to: "/coaching/$engagementId/$subjectId",
      params: { engagementId, subjectId },
    });
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="page-title">People you coach</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          The work each colleague has chosen to share with you.
        </p>
      </header>

      {isLoading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {error ? <p className="text-sm text-destructive">{error.message}</p> : null}

      <div className="space-y-2">
        {subjects.map((subject) => (
          <button
            key={`${subject.coach_profile_id}:${subject.engagement_id}:${subject.subject_id}`}
            type="button"
            onClick={() =>
              openPacket(subject.coach_profile_id, subject.engagement_id, subject.subject_id)
            }
            className="block w-full rounded-[var(--radius)] border border-border bg-card px-5 py-4 text-left shadow-card transition-colors hover:bg-accent-soft"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{subject.subject_name}</p>
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                {subject.engagement_code}
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">{subject.engagement_title}</p>
            {multiOrg ? (
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {subject.org_name}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {subject.total_decisions} confirmed decision
                {subject.total_decisions === 1 ? "" : "s"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {subject.total_elements} mapped work element
                {subject.total_elements === 1 ? "" : "s"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                {sinceLabel(subject.last_note_at)}
              </span>
            </div>
            {subject.last_note_at && (subject.new_decisions > 0 || subject.new_elements > 0) ? (
              <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-[0.06em] text-accent-deep">
                New since your last note: {subject.new_decisions} decision
                {subject.new_decisions === 1 ? "" : "s"}, {subject.new_elements} work element
                {subject.new_elements === 1 ? "" : "s"}
              </p>
            ) : null}
          </button>
        ))}

        {subjects.length === 0 && !isLoading ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When someone invites you to coach their work, it appears here.
            </p>
            <div className="max-w-lg">
              <EnterInviteCode label="Have an invite?" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

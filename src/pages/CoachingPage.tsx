import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { CoachLinkPeople } from "@/components/coaching/CoachLinkPeople";
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
  const { data: profile, profiles } = useProfile();
  const { data: subjects, isLoading, error } = useAllCoachSubjects(profiles);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // A failed read should not paint API text above the fold. The honest empty
  // state stands, and the failure is said plainly in a toast.
  const failed = Boolean(error);
  useEffect(() => {
    if (failed) toast.error("We could not load the people you coach just now.");
  }, [failed]);
  const multiOrg = new Set(subjects.map((s) => s.coach_profile_id)).size > 1;
  // A coach should always be able to see which workspace they are coaching in,
  // even before anything has been shared with them.
  const orgLine = profile?.org_name ? `You coach at ${profile.org_name}` : null;

  function openPacket(coachProfileId: string, engagementId: string, subjectId: string) {
    setActiveProfileId(coachProfileId);
    // Switching the active profile changes who the next reads run as. Only the
    // three surfaces that depend on that need refreshing: the profile itself,
    // this queue, and the packet about to open.
    void queryClient.invalidateQueries({ queryKey: ["profiles"] });
    void queryClient.invalidateQueries({ queryKey: ["coach-subjects"] });
    void queryClient.invalidateQueries({ queryKey: ["packet", engagementId, subjectId] });
    navigate({
      to: "/coaching/$engagementId/$subjectId",
      params: { engagementId, subjectId },
    });
  }

  return (
    <div>
      <header className="mb-8">
        <h1 className="page-title">People you coach</h1>
        {orgLine ? (
          <p className="page-subtitle">
            {orgLine}
          </p>
        ) : null}
        <p className="mt-1.5 text-sm text-muted-foreground">
          The work each colleague has chosen to share with you.
        </p>
      </header>

      <CoachLinkPeople />

      {isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((row) => (
            <div
              key={row}
              className="h-[104px] animate-pulse rounded-[var(--radius)] border border-border bg-card shadow-card"
            />
          ))}
        </div>
      ) : null}

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
              <p className="mt-2 inline-block rounded-full bg-accent-soft px-3 py-1 font-mono text-[11px] tracking-[0.06em] text-foreground">
                New since your last note: {subject.new_decisions} decision
                {subject.new_decisions === 1 ? "" : "s"}, {subject.new_elements} work element
                {subject.new_elements === 1 ? "" : "s"}
              </p>
            ) : null}
          </button>
        ))}

        {subjects.length === 0 && !isLoading ? (
          <div className="space-y-4">
            <div className="rounded-[var(--radius)] border border-border bg-card px-5 py-4 shadow-card">
              <p className="micro-label">Nothing shared yet</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing has been shared with you so far. That is the normal starting point: work
                stays private to the person who did it until they choose to share an engagement.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                The moment someone shares one, it appears here. Nothing else is needed from you.
              </p>
            </div>
            <div className="max-w-lg">
              <EnterInviteCode label="Have an invite?" />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

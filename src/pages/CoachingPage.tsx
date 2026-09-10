import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { CoachLinkPeople } from "@/components/coaching/CoachLinkPeople";
import { EnterInviteCode } from "@/components/invites/EnterInviteCode";
import { ToneCard } from "@/components/notebook/ToneCard";
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

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
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
        <h1 className="page-title">
          People <em className="italic">you coach</em>
        </h1>
        {orgLine ? (
          <p className="page-subtitle">{orgLine}</p>
        ) : null}
        <p className="mt-1.5 text-sm text-muted-foreground">
          The work each colleague has chosen to share with you.
        </p>
      </header>

      <CoachLinkPeople />

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div className="min-w-0">
          {isLoading ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((row) => (
                <div key={row} className="h-[76px] animate-pulse border-b border-border bg-card" />
              ))}
            </div>
          ) : null}

          {subjects.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[minmax(180px,1fr)_minmax(190px,1.15fr)_minmax(210px,1.2fr)_130px] gap-4 border-b border-border px-2 pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-soft">
                  <span>Person</span>
                  <span>Engagement</span>
                  <span>Shared with you</span>
                  <span>Last note</span>
                </div>
                {subjects.map((subject) => (
                  <button
                    key={`${subject.coach_profile_id}:${subject.engagement_id}:${subject.subject_id}`}
                    type="button"
                    onClick={() =>
                      openPacket(subject.coach_profile_id, subject.engagement_id, subject.subject_id)
                    }
                    className="grid min-h-[76px] w-full grid-cols-[minmax(180px,1fr)_minmax(190px,1.15fr)_minmax(210px,1.2fr)_130px] items-center gap-4 border-b border-border px-2 py-3 text-left transition-colors hover:bg-accent-soft"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card font-mono text-[10px] text-foreground">
                        {initials(subject.subject_name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold text-foreground">
                          {subject.subject_name}
                        </span>
                        {multiOrg ? (
                          <span className="mt-0.5 block truncate font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                            {subject.org_name}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11.5px] font-medium text-foreground">
                        {subject.engagement_title}
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        {subject.engagement_code}
                      </span>
                    </span>
                    <span className="min-w-0 text-[11.5px] leading-[17px] text-muted-foreground">
                      <span className="block">
                        {subject.total_decisions} confirmed decision
                        {subject.total_decisions === 1 ? "" : "s"}
                      </span>
                      <span className="block">
                        {subject.total_elements} mapped work element
                        {subject.total_elements === 1 ? "" : "s"}
                      </span>
                      {subject.last_note_at &&
                      (subject.new_decisions > 0 || subject.new_elements > 0) ? (
                        <span className="mt-1 block text-foreground">
                          New since your last note: {subject.new_decisions} decision
                          {subject.new_decisions === 1 ? "" : "s"}, {subject.new_elements} work
                          element{subject.new_elements === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-[11.5px] text-muted-foreground">
                      {sinceLabel(subject.last_note_at)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {subjects.length === 0 && !isLoading ? (
            <div className="space-y-4">
              <div className="border-y border-border py-5">
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

        <aside className="mt-10 space-y-4 lg:mt-0">
          <ToneCard
            tone="record"
            label="WHAT YOU CAN SEE"
            title="Work, never people."
            className="gap-3 p-4"
          >
            <p>
              There is no ranking and no measure of pace or effort. This view is only for the work
              each colleague chose to share, and it always will be.
            </p>
          </ToneCard>
          <ToneCard tone="paper" label="WHAT YOU CANNOT SEE" className="gap-3 p-4">
            <p>Drafts</p>
            <p>Unmapped work</p>
            <p>Unsent reflections</p>
            <p>Other engagements</p>
          </ToneCard>
          <p className="font-hand text-green">coach the work, not the person</p>
        </aside>
      </div>
    </div>
  );
}

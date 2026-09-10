import { PageHeader } from "@/components/layout/PageHeader";
import { CoachNoteList } from "@/components/coaching/CoachNoteList";
import { ToneCard } from "@/components/notebook/ToneCard";
import { useAllNotesAboutMe } from "@/hooks/use-subject-coaching";
import { useProfile } from "@/hooks/use-profile";
import { isCoach } from "@/lib/role-access";

/**
 * Every note written about this person's work, across engagements. A coach
 * reads notes through the coaching surface instead, so this is not for them.
 */
export function CoachNotesPage() {
  const { data: profile } = useProfile();
  const { data: notes } = useAllNotesAboutMe(isCoach(profile) ? undefined : profile?.id);

  if (isCoach(profile)) {
    return (
      <div>
        <PageHeader
          title="Notes"
          italicWord="about your work"
          subtitle="Notes you write live with the person you wrote them for."
        />
      </div>
    );
  }

  const rows = notes ?? [];

  return (
    <div>
      <PageHeader
        title="Notes"
        italicWord="about your work"
        subtitle="What your coaches wrote, newest first."
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <CoachNoteList
              notes={rows}
              surface="all"
              seenKey="all"
              orgId={profile?.org_id}
              context={(note) => {
                const row = rows.find((entry) => entry.id === note.id);
                const engagement = row?.engagements;
                if (!engagement) return null;
                return engagement.title || engagement.code || null;
              }}
            />
          )}
        </div>

        <aside className="mt-10 space-y-6 lg:mt-0">
          <ToneCard
            tone="record"
            label="YOU SEE EVERY NOTE"
            title="There is no private note about you."
            className="gap-4 p-4"
          >
            <p>Every note a coach writes about your work is available here for you to read.</p>
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-2xl text-foreground">{rows.length}</p>
                <p className="text-sm text-muted-foreground">notes about your work</p>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-2xl text-foreground">
                  {rows.filter((row) => row.engagement_id).length}
                </p>
                <p className="text-sm text-muted-foreground">point at an engagement</p>
              </div>
              <div className="border-t border-border pt-4">
                <p className="text-2xl text-foreground">0</p>
                <p className="text-sm text-muted-foreground">you are not allowed to see</p>
              </div>
            </div>
          </ToneCard>
          <p className="font-hand text-green">a note you cannot read is a rumour</p>
        </aside>
      </div>
    </div>
  );
}

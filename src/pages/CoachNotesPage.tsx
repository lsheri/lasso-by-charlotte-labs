import { PageHeader } from "@/components/layout/PageHeader";
import { CoachNoteList } from "@/components/coaching/CoachNoteList";
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
          title="Notes about your work"
          subtitle="Notes you write live with the person you wrote them for."
        />
      </div>
    );
  }

  const rows = notes ?? [];

  return (
    <div>
      <PageHeader
        title="Notes about your work"
        subtitle="What your coaches wrote, newest first."
      />
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
  );
}

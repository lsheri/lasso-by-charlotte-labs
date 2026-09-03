import { CoachNoteList, noteWhen } from "@/components/coaching/CoachNoteList";
import { useNotesAboutMe, useQueriesAboutMe } from "@/hooks/use-subject-coaching";

export function SubjectCoachingSection({
  profileId,
  engagementId,
  orgId,
}: {
  profileId: string | undefined;
  engagementId: string;
  orgId?: string | undefined;
}) {
  const { data: notes } = useNotesAboutMe(profileId, engagementId);
  const { data: queries } = useQueriesAboutMe(profileId, engagementId);

  const hasNotes = (notes ?? []).length > 0;
  const hasQueries = (queries ?? []).length > 0;
  if (!hasNotes && !hasQueries) return null;

  return (
    <div className="mt-10 space-y-8">
      {hasNotes ? (
        <section>
          <h2 className="micro-label micro-label-section">Notes from your coach</h2>
          <div className="mt-3">
            <CoachNoteList
              notes={notes ?? []}
              surface="engagement"
              seenKey={`engagement.${engagementId}`}
              orgId={orgId}
            />
          </div>
        </section>
      ) : null}

      {hasQueries ? (
        <section>
          <h2 className="micro-label micro-label-section">Questions asked about your work</h2>
          <div className="mt-3 space-y-1.5">
            {(queries ?? []).map((entry) => (
              <div
                key={entry.id}
                className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card"
              >
                <p className="text-sm text-foreground">{entry.question}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {entry.profiles?.display_name ?? "A coach"} · {noteWhen(entry.created_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

import { CoachingNoteCard } from "@/pages/PacketPage";
import { useNotesAboutMe, useQueriesAboutMe } from "@/hooks/use-subject-coaching";

function when(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function SubjectCoachingSection({
  profileId,
  engagementId,
}: {
  profileId: string | undefined;
  engagementId: string;
}) {
  const { data: notes } = useNotesAboutMe(profileId, engagementId);
  const { data: queries } = useQueriesAboutMe(profileId);

  const hasNotes = (notes ?? []).length > 0;
  const hasQueries = (queries ?? []).length > 0;
  if (!hasNotes && !hasQueries) return null;

  return (
    <div className="mt-10 space-y-8">
      {hasNotes ? (
        <section>
          <h2 className="micro-label">Coaching</h2>
          <div className="mt-3 space-y-2">
            {(notes ?? []).map((note) => (
              <CoachingNoteCard
                key={note.id}
                note={note}
                heading={`${note.profiles?.display_name ?? "Your coach"} · ${when(note.created_at)}`}
              />
            ))}
          </div>
        </section>
      ) : null}

      {hasQueries ? (
        <section>
          <h2 className="micro-label">Questions asked about your work</h2>
          <div className="mt-3 space-y-1.5">
            {(queries ?? []).map((entry) => (
              <div
                key={entry.id}
                className="rounded-[var(--radius)] border border-border bg-card px-4 py-3 shadow-card"
              >
                <p className="text-sm text-foreground">{entry.question}</p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {entry.profiles?.display_name ?? "A coach"} · {when(entry.created_at)}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

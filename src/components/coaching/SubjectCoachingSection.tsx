import type { CSSProperties } from "react";

import { CoachNoteList, noteWhen } from "@/components/coaching/CoachNoteList";
import { notePaper } from "@/components/work/note-paper";
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
          <h2 className="micro-label micro-label-section">Questions asked here</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A record of what was asked here, newest first.
          </p>
          <div className="nb-paper-wall mt-3">
            {(queries ?? []).map((entry) => (
              <div
                key={entry.id}
                className="nb-paper"
                style={{
                  ...notePaper(entry.id),
                  "--nb-paper-fill": "var(--paper-5)",
                  "--nb-paper-edge": "var(--nb-yellow-edge)",
                } as CSSProperties}
              >
                <div className="nb-paper-body">
                  <p className="text-sm text-foreground">{entry.question}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {entry.profiles?.display_name ?? "A coach"} · {noteWhen(entry.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

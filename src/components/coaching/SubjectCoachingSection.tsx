import type { CSSProperties } from "react";

import { CoachNoteList, noteWhen } from "@/components/coaching/CoachNoteList";
import { PaperTrail, type TrailStop } from "@/components/notebook/PaperTrail";
import { notePaper } from "@/components/work/note-paper";
import { useNotesAboutMe, useQueriesAboutMe } from "@/hooks/use-subject-coaching";
import { vendorLabel } from "@/lib/conversation-shared";
import { formatDate, type WorkItemRow } from "@/lib/work-types";

function trailStops(items: readonly WorkItemRow[]): TrailStop[] {
  return items.slice(0, 4).map((item) => {
    const when = item.work_date ?? item.created_at_source ?? item.captured_at;
    const source = vendorLabel(item.source_vendor) || item.source;
    return {
      id: item.id,
      eyebrow: `${source} · ${when ? formatDate(when) : ""}`.trim(),
      label: item.title.length > 34 ? `${item.title.slice(0, 33)}…` : item.title,
    };
  });
}

export function SubjectCoachingSection({
  profileId,
  engagementId,
  orgId,
  items = [],
  shipped = false,
}: {
  profileId: string | undefined;
  engagementId: string;
  orgId?: string | undefined;
  /** The work already on this page; used only for the illustration's cards. */
  items?: readonly WorkItemRow[] | undefined;
  /** Something in this engagement has gone to the firm. */
  shipped?: boolean | undefined;
}) {
  const { data: notes } = useNotesAboutMe(profileId, engagementId);
  const { data: queries } = useQueriesAboutMe(profileId, engagementId);

  const hasNotes = (notes ?? []).length > 0;
  const hasQueries = (queries ?? []).length > 0;
  const stops = trailStops(items);
  if (!hasNotes && !hasQueries && stops.length === 0) return null;

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

      {stops.length > 0 ? (
        <section data-testid="coaching-ship-trail">
          <div className="min-h-[260px]">
            <PaperTrail stops={stops} end="letter" muted={!shipped} className="h-[260px]" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {shipped ? "This went to the firm." : "Nothing has gone to the firm yet."}
          </p>
        </section>
      ) : null}



      {hasQueries ? (
        <section>
          <h2 className="micro-label micro-label-section">Questions asked here</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            A record of what was asked here, newest first.
          </p>
          <div className="nb-paper-wall mt-3" data-testid="question-history-notes">
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

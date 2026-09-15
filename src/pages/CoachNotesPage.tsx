import { useState } from "react";

import { PageHeader } from "@/components/layout/PageHeader";
import { CoachNoteList } from "@/components/coaching/CoachNoteList";
import { CoachNoteModal, type ModalNote } from "@/components/coaching/CoachNoteModal";
import { ToneCard } from "@/components/notebook/ToneCard";
import { useAllNotesAboutMe, type AccountNote } from "@/hooks/use-subject-coaching";
import { useProfile } from "@/hooks/use-profile";
import { isCoach } from "@/lib/role-access";

/**
 * Every note written about this person's work, across engagements. A coach
 * reads notes through the coaching surface instead, so this is not for them.
 */
export function CoachNotesPage() {
  const { data: profile } = useProfile();
  const coach = isCoach(profile);
  const { data: notes } = useAllNotesAboutMe(coach ? undefined : profile?.id);
  const [openId, setOpenId] = useState<string | null>(null);

  if (coach) {
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

  const rows: AccountNote[] = notes ?? [];
  // A circle is only ever drawn for the person the note is about.
  const unreadIds = new Set(rows.filter((row) => row.read_at === null).map((row) => row.id));
  const open = rows.find((row) => row.id === openId) ?? null;
  const openNote: ModalNote | null = open
    ? {
        id: open.id,
        created_at: open.created_at,
        did_well: open.did_well,
        would_try: open.would_try,
        watch_next: open.watch_next,
        engagement_id: open.engagement_id,
        task_id: open.task_id,
        work_item_id: open.work_item_id,
        profiles: open.profiles,
      }
    : null;

  return (
    <div>
      {/*
        Figma 32:1709 subtitle: "Eleven notes from Priya · every one points at a
        piece of work · you see all eleven". The last clause is the page's whole
        argument, so it is said in numbers rather than described.

        Deliberate deviation: the frame names the coach. A person can have more
        than one coach across engagements and this page spans all of them, so it
        counts the notes instead of naming a single author.
      */}
      <PageHeader
        title="Notes from your"
        italicWord="coach"
        subtitle={[
          `${rows.length} note${rows.length === 1 ? "" : "s"} about your work`,
          "every one points at a piece of work",
          `you see all ${rows.length}`,
        ].join(" · ")}
      />
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
        <div>
          {rows.length === 0 ? (
            <p className="rounded-[var(--radius-md)] border border-dashed border-pencil bg-card px-4 py-6 text-center text-sm text-muted-foreground">
              Nothing here yet.
            </p>
          ) : (
            <CoachNoteList
              notes={rows}
              surface="all"
              seenKey="all"
              orgId={profile?.org_id}
              layout="rows"
              unreadIds={unreadIds}
              onOpenNote={setOpenId}
              groupOf={(note) => {
                const row = rows.find((entry) => entry.id === note.id);
                const engagement = row?.engagements;
                return engagement?.title || engagement?.code || "";
              }}
              pointsAt={(note) => {
                const row = rows.find((entry) => entry.id === note.id);
                return row?.work_items?.title ?? row?.tasks?.name ?? null;
              }}
              context={(note) => {
                const row = rows.find((entry) => entry.id === note.id);
                const engagement = row?.engagements;
                if (!engagement) return null;
                return engagement.title || engagement.code || null;
              }}
            />
          )}
          <p className="mt-6 font-hand text-[16px] text-green">
            a conversation about the work, not about the person
          </p>
        </div>

        <aside className="mt-10 space-y-6 lg:mt-0">
          {/* Figma 32:1709 keeps the promise and the numbers apart: the green
              card says the one thing that matters, and the counts stand under it
              on their own, unboxed. */}
          <ToneCard
            tone="record"
            label="YOU SEE EVERY NOTE"
            title="There is no private note about you."
            className="gap-3 p-4"
          >
            <p className="leading-[19px]">
              A coach cannot write a note you cannot read. If a note about your work exists, it is
              on this page, with the work it points at.
            </p>
          </ToneCard>

          <div>
            {(
              [
                [rows.length, "notes about your work"],
                [rows.filter((row) => row.engagement_id).length, "point at an engagement"],
                [0, "you are not allowed to see"],
              ] as Array<[number, string]>
            ).map(([value, caption]) => (
              <div key={caption} className="border-b border-border py-3">
                {/* Instrument Serif at display size, as the frame sets it:
                    light and roomy, never bold. */}
                <p className="font-serif text-[30px] leading-[36px] tabular-nums text-foreground">
                  {value}
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{caption}</p>
              </div>
            ))}
          </div>
          <p className="font-hand text-green">a note you cannot read is a rumour</p>
        </aside>
      </div>

      <CoachNoteModal
        note={openNote}
        open={openNote !== null}
        onOpenChange={(next) => {
          if (!next) setOpenId(null);
        }}
      />
    </div>
  );
}

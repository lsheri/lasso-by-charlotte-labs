import { useEffect, useMemo, useRef } from "react";

import { CoachingNoteCard } from "@/pages/PacketPage";
import { CircleMark } from "@/components/notebook/CircleMark";
import { logEvent } from "@/lib/telemetry";
import {
  isNewSince,
  newestAgeBand,
  notesShownBand,
  readNotesSeen,
  writeNotesSeen,
} from "@/lib/coach-notes";
import { firstLine, firstName } from "@/lib/coach-note-scope";

export type ReadableNote = {
  id: string;
  created_at: string;
  did_well: string;
  would_try: string;
  watch_next: string;
  profiles: { display_name: string } | null;
};

export type NoteReadSurface = "engagement" | "all";

export function noteWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Notes about one person's work, newest first. Nothing is counted at the
 * person: no tally, no badge, only a quiet word on what arrived since the
 * last time this view was open.
 *
 * PASS D adds a rows layout, grouped by the work they came from, and a circle
 * around anything not opened yet. The circle is a mark, never a count.
 */
export function CoachNoteList({
  notes,
  surface,
  seenKey,
  orgId,
  context,
  layout = "cards",
  unreadIds,
  onOpenNote,
  pointsAt,
  groupOf,
}: {
  notes: ReadableNote[];
  surface: NoteReadSurface;
  seenKey: string;
  orgId: string | undefined;
  /** One short line under a note saying where it came from. */
  context?: (note: ReadableNote) => string | null;
  /** "cards" keeps the original reading card; "rows" is the notes page. */
  layout?: "cards" | "rows";
  /** Notes this person has not opened yet. Never handed to a coach. */
  unreadIds?: ReadonlySet<string>;
  onOpenNote?: (noteId: string) => void;
  /** What the note points at, in the person's own words for that thing. */
  pointsAt?: (note: ReadableNote) => string | null;
  /** The heading a row sits under, in rows layout. */
  groupOf?: (note: ReadableNote) => string;
}) {
  const lastSeen = useMemo(
    () => (typeof window === "undefined" ? null : readNotesSeen(seenKey)),
    [seenKey],
  );
  const logged = useRef(false);

  // One record per view of the surface, never one per note. Bands only: no
  // names, no engagement, and none of the words in a note.
  useEffect(() => {
    if (logged.current || !orgId || notes.length === 0) return;
    logged.current = true;
    logEvent("coachnote.read", orgId, {
      surface,
      notes_shown_band: notesShownBand(notes.length),
      newest_age_band: newestAgeBand(notes[0]?.created_at ?? null),
    });
    writeNotesSeen(seenKey, new Date().toISOString());
  }, [orgId, notes, surface, seenKey]);

  const groups = useMemo(() => {
    if (layout !== "rows") return [];
    const map = new Map<string, ReadableNote[]>();
    for (const note of notes) {
      const key = groupOf?.(note) ?? "";
      const list = map.get(key) ?? [];
      list.push(note);
      map.set(key, list);
    }
    return Array.from(map.entries());
  }, [layout, notes, groupOf]);

  if (layout === "rows") {
    return (
      <div className="space-y-8">
        {groups.map(([group, rows]) => (
          <section key={group || "ungrouped"}>
            {group ? <h2 className="micro-label micro-label-section">{group}</h2> : null}
            <div className="mt-2">
              {rows.map((note) => {
                const author = note.profiles?.display_name ?? "Your coach";
                const where = pointsAt?.(note) ?? null;
                const unread = unreadIds?.has(note.id) ?? false;
                const row = (
                  <button
                    type="button"
                    onClick={() => onOpenNote?.(note.id)}
                    className="block w-full border-b border-[var(--nb-rule)] px-1 py-4 text-left"
                  >
                    <div className="flex flex-wrap items-baseline gap-3">
                      <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                        {noteWhen(note.created_at)}
                      </span>
                      <span className="text-[13px] text-foreground">{author}</span>
                    </div>
                    <p className="mt-1.5 text-[13px] text-foreground">
                      {firstLine(note.did_well)}
                    </p>
                    {where ? (
                      <p className="mt-1 font-hand text-[16px] text-green">points at {where}</p>
                    ) : null}
                  </button>
                );
                return (
                  <div key={note.id} className={unread ? "py-2" : undefined}>
                    {unread ? (
                      <CircleMark label={`New note from ${firstName(author)}`}>{row}</CircleMark>
                    ) : (
                      row
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {notes.map((note) => {
        const where = context?.(note) ?? null;
        const author = note.profiles?.display_name ?? "Your coach";
        return (
          <div key={note.id}>
            {isNewSince(note.created_at, lastSeen) ? (
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                New
              </p>
            ) : null}
            <CoachingNoteCard
              note={note}
              heading={`${author} · ${noteWhen(note.created_at)}${where ? ` · ${where}` : ""}`}
            />
          </div>
        );
      })}
    </div>
  );
}

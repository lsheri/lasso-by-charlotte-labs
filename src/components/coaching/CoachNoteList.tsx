import { useEffect, useMemo, useRef } from "react";

import { CoachingNoteCard } from "@/pages/PacketPage";
import { logEvent } from "@/lib/telemetry";
import {
  isNewSince,
  newestAgeBand,
  notesShownBand,
  readNotesSeen,
  writeNotesSeen,
} from "@/lib/coach-notes";

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
 */
export function CoachNoteList({
  notes,
  surface,
  seenKey,
  orgId,
  context,
}: {
  notes: ReadableNote[];
  surface: NoteReadSurface;
  seenKey: string;
  orgId: string | undefined;
  /** One short line under a note saying where it came from. */
  context?: (note: ReadableNote) => string | null;
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

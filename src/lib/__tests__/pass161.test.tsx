import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";

import {
  DAYS_TO_NOTE_BANDS,
  NEWEST_AGE_BANDS,
  NOTES_SHOWN_BANDS,
  daysToNoteBand,
  isNewSince,
  newestAgeBand,
  notesShownBand,
} from "@/lib/coach-notes";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));

import { CoachNoteList } from "@/components/coaching/CoachNoteList";

const DAY = 86400000;

describe("pass 161 bands", () => {
  it("bands how many notes were shown, edges exact", () => {
    expect(notesShownBand(0)).toBe("0");
    expect(notesShownBand(1)).toBe("1");
    expect(notesShownBand(2)).toBe("2-5");
    expect(notesShownBand(5)).toBe("2-5");
    expect(notesShownBand(6)).toBe("6+");
    expect(notesShownBand(400)).toBe("6+");
  });

  it("bands the age of the newest note, edges exact", () => {
    const now = new Date("2026-03-01T12:00:00Z");
    const at = (days: number) => new Date(now.getTime() - days * DAY);
    expect(newestAgeBand(at(0.5), now)).toBe("under_1d");
    expect(newestAgeBand(at(1), now)).toBe("1-7d");
    expect(newestAgeBand(at(7), now)).toBe("1-7d");
    expect(newestAgeBand(at(7.5), now)).toBe("8-30d");
    expect(newestAgeBand(at(30), now)).toBe("8-30d");
    expect(newestAgeBand(at(31), now)).toBe("30d+");
  });

  it("bands the distance from the work to the note, unknown when undated", () => {
    const note = new Date("2026-03-01T12:00:00Z");
    const before = (days: number) => new Date(note.getTime() - days * DAY);
    expect(daysToNoteBand(before(0), note)).toBe("same_day");
    expect(daysToNoteBand(before(1), note)).toBe("1-3d");
    expect(daysToNoteBand(before(3), note)).toBe("1-3d");
    expect(daysToNoteBand(before(4), note)).toBe("4-7d");
    expect(daysToNoteBand(before(7), note)).toBe("4-7d");
    expect(daysToNoteBand(before(8), note)).toBe("8-30d");
    expect(daysToNoteBand(before(30), note)).toBe("8-30d");
    expect(daysToNoteBand(before(31), note)).toBe("30d+");
    expect(daysToNoteBand(null, note)).toBe("unknown");
    expect(daysToNoteBand("not a date", note)).toBe("unknown");
  });

  it("marks a note new only when it landed after the last visit", () => {
    expect(isNewSince("2026-03-02T00:00:00Z", "2026-03-01T00:00:00Z")).toBe(true);
    expect(isNewSince("2026-03-01T00:00:00Z", "2026-03-02T00:00:00Z")).toBe(false);
    expect(isNewSince("2026-03-01T00:00:00Z", null)).toBe(false);
  });
});

const notes = [
  {
    id: "a",
    created_at: new Date().toISOString(),
    did_well: "Framed the brief clearly",
    would_try: "Show the options sooner",
    watch_next: "Keep the summary short",
    profiles: { display_name: "Rae" },
  },
  {
    id: "b",
    created_at: new Date(Date.now() - 3 * DAY).toISOString(),
    did_well: "Good sourcing",
    would_try: "Say the call out loud",
    watch_next: "Timing",
    profiles: { display_name: "Rae" },
  },
];

describe("pass 161 read signal", () => {
  beforeEach(() => {
    logEvent.mockClear();
    window.localStorage.clear();
  });

  it("records one event per view, not one per note, with closed vocab dims", () => {
    render(<CoachNoteList notes={notes} surface="all" seenKey="all" orgId="org-1" />);
    expect(logEvent).toHaveBeenCalledTimes(1);
    const [name, orgId, dims] = logEvent.mock.calls[0] as [string, string, Record<string, string>];
    expect(name).toBe("coachnote.read");
    expect(orgId).toBe("org-1");
    expect(["engagement", "all"]).toContain(dims.surface);
    expect(NOTES_SHOWN_BANDS as readonly string[]).toContain(dims.notes_shown_band);
    expect(NEWEST_AGE_BANDS as readonly string[]).toContain(dims.newest_age_band);
    expect(Object.keys(dims).sort()).toEqual([
      "newest_age_band",
      "notes_shown_band",
      "surface",
    ]);
  });

  it("never puts note words in a dim", () => {
    render(<CoachNoteList notes={notes} surface="engagement" seenKey="e1" orgId="org-1" />);
    const dims = (logEvent.mock.calls[0] as unknown[])[2] as Record<string, string>;
    const values = Object.values(dims).join(" ");
    for (const word of ["Framed", "sourcing", "summary", "Rae", "Timing"]) {
      expect(values).not.toContain(word);
    }
  });

  it("renders the notes with author and date and no counts", () => {
    render(<CoachNoteList notes={notes} surface="all" seenKey="all" orgId="org-1" />);
    expect(screen.getAllByText("What went well").length).toBe(2);
    expect(screen.queryByText(/2 notes/i)).toBeNull();
  });

  it("stays silent when there is nothing to read", () => {
    render(<CoachNoteList notes={[]} surface="all" seenKey="all" orgId="org-1" />);
    expect(logEvent).not.toHaveBeenCalled();
  });

  it("keeps every band value in its closed vocabulary", () => {
    expect(DAYS_TO_NOTE_BANDS).toContain("unknown");
  });
});

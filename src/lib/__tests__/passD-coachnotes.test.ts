import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { firstLine, firstName, newNoteLine, scopeChoices, scopeOf } from "@/lib/coach-note-scope";

const read = (path: string) => readFileSync(`${process.cwd()}/${path}`, "utf8");

/**
 * PASS D — the two new event names, the read-mark function, and the one rule
 * that must never bend: a coach is never shown the circle.
 */
describe("pass D · coaching notes", () => {
  it("pins the two additive event names", () => {
    const shared = read("src/lib/telemetry-shared.ts");
    expect(shared).toContain("coachnote.scoped");
    expect(shared).toContain("coachnote.replied");

    expect(read("src/components/coaching/NoteComposer.tsx")).toContain(
      'logEvent("coachnote.scoped"',
    );
    const modal = read("src/components/coaching/CoachNoteModal.tsx");
    expect(modal).toContain('logEvent("coachnote.replied"');
    expect(modal).toContain('logEvent("coachnote.read"');
  });

  it("marks a note read through the database function, never a direct write", () => {
    const thread = read("src/hooks/use-coach-note-thread.ts");
    expect(thread).toContain('supabase.rpc("mark_coaching_note_read"');
    expect(thread).not.toContain('.update({ read_at');
  });

  it("never asks for unread notes as a coach, so the circle cannot render", () => {
    const sidebar = read("src/components/layout/SidebarNav.tsx");
    expect(sidebar).toContain("useUnreadNotesAboutMe(isCoach ? undefined : profile?.id)");

    const ledger = read("src/components/engagements/WorkLedger.tsx");
    expect(ledger).toContain("useUnreadNotesAboutMe(isCoach ? undefined : profileId)");

    const page = read("src/pages/CoachNotesPage.tsx");
    expect(page).toContain("useAllNotesAboutMe(coach ? undefined : profile?.id)");
    expect(page).toMatch(/if \(coach\) \{/);
  });

  it("never draws a count at the person", () => {
    const circle = read("src/components/notebook/CircleMark.tsx");
    expect(circle).not.toMatch(/count-pill|<sup|\{count\}/);
  });

  it("scopes a note to the smallest thing it names", () => {
    expect(scopeOf({})).toBe("engagement");
    expect(scopeOf({ task_id: "t1" })).toBe("task");
    expect(scopeOf({ task_id: "t1", work_item_id: "w1" })).toBe("work_item");
  });

  it("leads with the piece of work outside a firm, and hides the middle chip with no workstreams", () => {
    expect(scopeChoices("company", true)).toEqual(["engagement", "task", "work_item"]);
    expect(scopeChoices("personal", true)[0]).toBe("work_item");
    expect(scopeChoices("personal", false)).not.toContain("task");
  });

  it("says a new note in words, never a number alone", () => {
    expect(newNoteLine(1, "Priya Raman")).toBe("1 new note from Priya");
    expect(newNoteLine(3, "Priya Raman")).toBe("3 new notes from Priya");
    expect(firstName(null)).toBe("your coach");
    expect(firstLine("  \nfirst line\nsecond")).toBe("first line");
  });
});

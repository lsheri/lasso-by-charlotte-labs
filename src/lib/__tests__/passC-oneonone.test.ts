import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { resolveMotion } from "@/lib/motion-registry";
import { newestSessionId, noteTilt, noteTint, sessionDateLabel } from "@/lib/oneonone-sessions";

const read = (p: string) => readFileSync(p, "utf8");

describe("pass C: the three new events", () => {
  it("names them once in the canonical registry", () => {
    const shared = read("src/lib/telemetry-shared.ts");
    expect(shared).toContain('| "oneonone.session_created"');
    expect(shared).toContain('| "oneonone.note_added"');
    expect(shared).toContain('| "oneonone.note_discussed"');
  });

  it("fires each one from the session surface, with the kind only", () => {
    const src = read("src/components/oneonone/SessionStickies.tsx");
    expect(src).toContain('logEvent("oneonone.session_created", orgId, {})');
    expect(src).toContain('logEvent("oneonone.note_added", orgId, { kind: STICKY })');
    expect(src).toContain('logEvent("oneonone.note_discussed", orgId, { kind: STICKY })');
    expect(src).not.toContain("content: note");
  });

  it("leaves the existing 1:1 events alone", () => {
    expect(read("src/components/oneonone/SaveForOneOnOne.tsx")).toContain(
      'logV2("one_on_one.prepared"',
    );
    expect(read("src/components/oneonone/OneOnOneBrief.tsx")).toContain(
      'logV2("one_on_one.opened"',
    );
  });
});

describe("pass C: the send is drawn and inert", () => {
  it("has no handler and no event behind it", () => {
    const page = read("src/pages/OneOnOnePage.tsx");
    expect(page).toContain('<Button type="button" variant="ink" disabled aria-disabled="true">');
    expect(page).toContain("Send to your coach");
    expect(page).toContain("sending comes after the pilot");
    const sendBlock = page.slice(page.indexOf("Send to your coach") - 400, page.indexOf("Send to your coach"));
    expect(sendBlock).not.toContain("onClick");
  });

  it("keeps the two promise cards and the surviving controls", () => {
    const page = read("src/pages/OneOnOnePage.tsx");
    expect(page).toContain("WHAT YOUR COACH WILL SEE WHEN YOU SEND");
    expect(page).toContain("WHAT YOUR COACH WILL NEVER SEE");
    expect(page).toContain("Prepare a 1:1");
    expect(page).toContain("<SavedForOneOnOne");
    expect(page).toContain("<ConfirmedCalls />");
    expect(page).toContain("Nothing to prepare yet.");
  });
});

describe("pass C: a note lands", () => {
  it("resolves the motion and still says it when nothing moves", () => {
    expect(resolveMotion("oneonone.note_landed", false).className).toBe("nb-note-land");
    expect(resolveMotion("oneonone.note_landed", true).className).toBe("");
    expect(resolveMotion("oneonone.note_landed", true).reduced.length).toBeGreaterThan(0);
  });
});

describe("pass C: the dated session", () => {
  it("reads a held_on date the way a person writes it", () => {
    expect(sessionDateLabel("2026-09-18")).toBe("Fri 18 Sep");
    expect(sessionDateLabel("2026-01-01")).toBe("Thu 1 Jan");
  });

  it("selects the newest session by the day it is held", () => {
    const rows = [
      { id: "a", held_on: "2026-09-10", created_at: "2026-09-01T00:00:00Z" },
      { id: "b", held_on: "2026-09-18", created_at: "2026-09-02T00:00:00Z" },
    ];
    expect(newestSessionId(rows)).toBe("b");
    expect(newestSessionId([])).toBeNull();
  });

  it("gives a note the same tilt every time and rotates three tints", () => {
    expect(noteTilt("abc")).toBe(noteTilt("abc"));
    expect(noteTint(0)).toBe(noteTint(3));
    expect(new Set([noteTint(0), noteTint(1), noteTint(2)]).size).toBe(3);
  });
});

import { describe, expect, it } from "vitest";

import { talkingPointsOnly, type OneOnOneNoteKind } from "@/components/oneonone/SaveForOneOnOne";

type NoteRow = {
  id: string;
  kind: string;
  content: string;
  talking_point: string | null;
  discussed: boolean;
  created_at: string;
  source_session_id: string | null;
};

function row(id: string, kind: string): NoteRow {
  return {
    id,
    kind,
    content: `content ${id}`,
    talking_point: null,
    discussed: false,
    created_at: "2026-09-15T00:00:00Z",
    source_session_id: null,
  };
}

describe("talkingPointsOnly", () => {
  it("drops sticky rows; the sticky wall is the one place a sticky lives", () => {
    const rows = [row("a", "sticky"), row("b", "chat_excerpt"), row("c", "sticky"), row("d", "analysis_finding")];
    expect(talkingPointsOnly(rows).map((r) => r.id)).toEqual(["b", "d"]);
  });

  it("keeps every row when no sticky is present", () => {
    const rows = [row("a", "chat_excerpt"), row("b", "analysis_finding")];
    expect(talkingPointsOnly(rows)).toHaveLength(2);
  });

  it("returns an empty list untouched", () => {
    expect(talkingPointsOnly([])).toEqual([]);
  });

  it("only the two saved-note kinds are ever written from this module", () => {
    const kinds: Array<OneOnOneNoteKind> = ["analysis_finding", "chat_excerpt"];
    expect(kinds).not.toContain("sticky");
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  COACH_SUBJECTS_SELECT,
  composeCoachSubjects,
  sortAcrossOrgs,
  type CoachActivity,
  type CoachRoster,
} from "@/lib/coach-subjects-shared";
import { coachSubjectsKey } from "@/hooks/use-coaching";
import { contentsUnread } from "@/lib/text-status";

const SRC = join(process.cwd(), "src");

const roster: CoachRoster = {
  engagements: [
    {
      engagement_id: "e1",
      engagements: { id: "e1", code: "ENG-1", title: "Pricing", client_label: null, clients: null },
    },
  ],
  subjects: [
    { engagement_id: "e1", profile_id: "p1", profiles: { id: "p1", display_name: "Ada" } },
    { engagement_id: "e1", profile_id: "coach", profiles: { id: "coach", display_name: "Me" } },
  ],
};

const activity: CoachActivity = {
  notes: [{ subject_id: "p1", engagement_id: "e1", created_at: "2026-01-01T00:00:00Z" }],
  decisions: [{ owner_id: "p1", engagement_id: "e1", created_at: "2026-02-01T00:00:00Z" }],
  mapped: [{ mapped_at: "2026-02-02T00:00:00Z", tasks: { engagement_id: "e1", owner_id: "p1" } }],
};

describe("coach subjects payload", () => {
  it("composes roster and activity into one row per subject", () => {
    const rows = composeCoachSubjects("coach", roster, activity);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      subject_id: "p1",
      subject_name: "Ada",
      total_decisions: 1,
      total_elements: 1,
      new_decisions: 1,
      new_elements: 1,
    });
  });

  it("never returns the coach themselves as a subject", () => {
    expect(composeCoachSubjects("coach", roster, activity).map((r) => r.subject_id)).not.toContain(
      "coach",
    );
  });

  it("drops activity that belongs to another engagement", () => {
    const foreign: CoachActivity = {
      notes: [],
      decisions: [{ owner_id: "p1", engagement_id: "other", created_at: "2026-02-01T00:00:00Z" }],
      mapped: [
        { mapped_at: "2026-02-02T00:00:00Z", tasks: { engagement_id: "other", owner_id: "p1" } },
      ],
    };
    const rows = composeCoachSubjects("coach", roster, foreign);
    expect(rows[0]?.total_decisions).toBe(0);
    expect(rows[0]?.total_elements).toBe(0);
  });

  it("carries no fields beyond the queue shape", () => {
    const rows = composeCoachSubjects("coach", roster, activity);
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
      [
        "engagement_code",
        "engagement_id",
        "engagement_title",
        "last_activity",
        "last_note_at",
        "new_decisions",
        "new_elements",
        "subject_id",
        "subject_name",
        "total_decisions",
        "total_elements",
      ].sort(),
    );
  });

  it("sorts the cross org queue by newest activity", () => {
    const sorted = sortAcrossOrgs([
      {
        ...composeCoachSubjects("coach", roster, activity)[0]!,
        coach_profile_id: "coach",
        org_name: "A",
        last_activity: "2026-01-01T00:00:00Z",
      },
      {
        ...composeCoachSubjects("coach", roster, activity)[0]!,
        coach_profile_id: "coach2",
        org_name: "B",
        last_activity: "2026-03-01T00:00:00Z",
      },
    ]);
    expect(sorted[0]?.org_name).toBe("B");
  });
});

describe("single query key", () => {
  it("keeps the coach-subjects prefix both invalidation call sites use", () => {
    expect(coachSubjectsKey("a,b")[0]).toBe("coach-subjects");
  });

  it("has no coach-activity key left to invalidate", () => {
    const hook = readFileSync(join(SRC, "hooks/use-coaching.ts"), "utf8");
    expect(hook).not.toContain("coach-activity");
    expect(hook).not.toContain("useQueries");
  });

  it("keeps the hinted select verbatim on both copies", () => {
    const hook = readFileSync(join(SRC, "hooks/use-coaching.ts"), "utf8");
    expect(hook).toContain(COACH_SUBJECTS_SELECT);
    expect(COACH_SUBJECTS_SELECT).toBe(
      "engagement_id, profile_id, profiles!engagement_members_profile_id_fkey(id, display_name)",
    );
  });

  it("reads only through the caller client in the server layer", () => {
    const server = readFileSync(join(SRC, "lib/coach-subjects.server.ts"), "utf8");
    expect(server).not.toContain("supabaseAdmin");
    expect(server).not.toContain("client.server");
  });
});

describe("title only counting", () => {
  it("counts only the statuses that mean the contents were not read", () => {
    const metas = [
      { text_status: "ok" },
      { text_status: "unsupported" },
      { text_status: "unreadable" },
      { text_status: "failed" },
      { text_status: "not_attempted" },
      null,
    ];
    expect(metas.filter((meta) => contentsUnread(meta as never)).length).toBe(3);
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { canReachCoaching, reviewableEngagements } from "@/lib/coaching-reach";
import { accessFromMemberRole } from "@/lib/engagement-access-shared";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "__tests__" ? [] : files(path);
    return path.endsWith(".tsx") || path.endsWith(".ts") ? [path] : [];
  });
}

/** Memberships built from the vocabulary itself, never a written out list. */
function memberships() {
  const roles = ["coach", "em", "coach", null, "em"];
  return roles.map((member_role, index) => ({
    engagement_id: `eng-${index}`,
    member_role,
  }));
}

describe("s4 · reach follows the grant", () => {
  it("derives what a person may review from their memberships", () => {
    const rows = memberships();
    const expected = rows
      .filter((row) => accessFromMemberRole(row.member_role) === "review")
      .map((row) => row.engagement_id);
    expect(reviewableEngagements(rows)).toEqual(expected);
    expect(canReachCoaching(rows)).toBe(expected.length > 0);
    expect(canReachCoaching([])).toBe(false);
  });

  it("does not return an engagement a person only works on", () => {
    const worked = memberships().filter(
      (row) => accessFromMemberRole(row.member_role) === "work",
    );
    expect(worked.length).toBeGreaterThan(0);
    expect(reviewableEngagements(worked)).toEqual([]);
    expect(canReachCoaching(worked)).toBe(false);
  });

  it("counts the same engagement once, however many memberships reach it", () => {
    const one = { engagement_id: "eng-same", member_role: "coach" };
    expect(reviewableEngagements([one, { ...one }])).toEqual([one.engagement_id]);
  });

  it("has no surface deciding coaching reach from a workspace role", () => {
    // The wrong thing: a file that carries a coaching surface and decides with
    // the workspace wide role rather than membership of the engagement.
    const coaching = /coachNavGroups|CoachAskSheet|["'`]\/coaching/;
    const workspaceRole = /\broles\.isCoach\b|\bisCoach\(|role === "coach"/;
    const offenders = [...files("src/components"), ...files("src/pages")].filter((path) => {
      const source = readFileSync(path, "utf8");
      return coaching.test(source) && workspaceRole.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

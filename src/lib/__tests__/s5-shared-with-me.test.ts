import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";
import { sharedWithMe, type SharedMembershipRow } from "@/lib/shared-with-me";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "__tests__" ? [] : files(path);
    return path.endsWith(".tsx") || path.endsWith(".ts") ? [path] : [];
  });
}

const MINE = ["me-1", "me-2"];

/** Rows built from the vocabulary, never a written out expectation. */
function rows(): SharedMembershipRow[] {
  const shape: { profile: string; role: string; addedBy: string | null; eng: string }[] = [
    { profile: "me-1", role: "coach", addedBy: "her", eng: "eng-b" },
    { profile: "me-1", role: "em", addedBy: "her", eng: "eng-a" },
    { profile: "me-2", role: "em", addedBy: "him", eng: "eng-c" },
    { profile: "me-1", role: "em", addedBy: null, eng: "eng-own" },
    { profile: "me-2", role: "coach", addedBy: "me-1", eng: "eng-self" },
    { profile: "not-me", role: "em", addedBy: "her", eng: "eng-other" },
  ];
  return shape.map((row) => ({
    engagement_id: row.eng,
    profile_id: row.profile,
    member_role: row.role,
    added_by: row.addedBy,
    engagement_title: row.eng.toUpperCase(),
    engagement_code: row.eng.slice(0, 3),
    granter_name: row.addedBy === "her" ? "Ada" : row.addedBy === "him" ? "Zed" : "Me",
  }));
}

function flatten(groups: ReturnType<typeof sharedWithMe>) {
  return groups.flatMap((group) =>
    group.engagements.map((engagement) => `${group.granterId}:${engagement.id}`),
  );
}

describe("s5 · shared with me", () => {
  it("only lists a board another person is recorded as having given you", () => {
    const all = rows();
    const expected = all
      .filter(
        (row) =>
          MINE.includes(row.profile_id) &&
          row.added_by !== null &&
          !MINE.includes(row.added_by),
      )
      .map((row) => `${row.added_by}:${row.engagement_id}`)
      .sort();
    expect(flatten(sharedWithMe(MINE, all)).sort()).toEqual(expected);
  });

  it("drops a membership nobody is recorded as having given", () => {
    const nullOnly = rows().filter((row) => row.added_by === null);
    expect(nullOnly.length).toBeGreaterThan(0);
    expect(sharedWithMe(MINE, nullOnly)).toEqual([]);
  });

  it("cannot show a board you gave yourself", () => {
    const selfGranted = rows().filter(
      (row) => row.added_by !== null && MINE.includes(row.added_by),
    );
    expect(selfGranted.length).toBeGreaterThan(0);
    expect(sharedWithMe(MINE, selfGranted)).toEqual([]);
  });

  it("makes no distinction between the two things a person can be given", () => {
    const all = rows().filter(
      (row) =>
        MINE.includes(row.profile_id) &&
        row.added_by !== null &&
        !MINE.includes(row.added_by),
    );
    const roles = new Set(all.map((row) => row.member_role));
    expect(roles.size).toBeGreaterThan(1);
    const shapes = sharedWithMe(MINE, all).flatMap((group) =>
      group.engagements.map((engagement) => Object.keys(engagement).sort().join(",")),
    );
    expect(new Set(shapes).size).toBe(1);
    expect(shapes[0]).not.toMatch(/role|access|review|work/);
  });

  it("lists a board once however many of your profiles hold it", () => {
    const base = rows().find((row) => row.added_by === "her");
    if (!base) throw new Error("fixture");
    const twice = [base, { ...base, profile_id: "me-2" }];
    const groups = sharedWithMe(MINE, twice);
    expect(flatten(groups)).toEqual([`${base.added_by}:${base.engagement_id}`]);
  });

  it("sorts people by name and each person's boards by title", () => {
    const groups = sharedWithMe(MINE, rows());
    const names = groups.map((group) => group.granterName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    for (const group of groups) {
      const titles = group.engagements.map((engagement) => engagement.title);
      expect(titles).toEqual([...titles].sort((a, b) => a.localeCompare(b)));
    }
  });

  it("has no surface deciding inline who shared something", () => {
    const offenders = [...files("src/components"), ...files("src/pages")].filter((path) =>
      /\badded_by\b/.test(readFileSync(path, "utf8")),
    );
    expect(offenders).toEqual([]);
  });

  it("carries no id on the shared event's dims", () => {
    const dims = EVENT_DIM_KEYS["shared.board_opened"];
    if (!dims) throw new Error("event not in the allowlist");
    expect(dims.filter((key) => /_id$/.test(key))).toEqual([]);
  });

  it("leaves the arbitrary small type out of the components", () => {
    const offenders = files("src/components").filter((path) =>
      readFileSync(path, "utf8").includes("text-[11.5px]"),
    );
    expect(offenders).toEqual([]);
  });

  it("keeps the two new inks in the stylesheet alone", () => {
    const inks = ["#b3410a", "#ff7a1a"];
    const sheet = readFileSync("src/styles.css", "utf8");
    for (const ink of inks) expect(sheet).toContain(ink);
    const offenders = [...files("src/components"), ...files("src/pages"), ...files("src/lib"), ...files("src/hooks")].filter(
      (path) => {
        const source = readFileSync(path, "utf8");
        return inks.some((ink) => source.includes(ink));
      },
    );
    expect(offenders).toEqual([]);
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * engagement_members holds two foreign keys to profiles (profile_id and
 * added_by). PostgREST refuses an embed that does not name one of them, so
 * these tests fail loudly here rather than in production if a query loses
 * its hint or a third foreign key arrives.
 */

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}

describe("engagement_members to profiles embeds", () => {
  it("pins the hinted relationship for the coach subjects query", () => {
    const source = readFileSync(join(SRC, "hooks/use-coaching.ts"), "utf8");
    expect(source).toContain(
      'export const COACH_SUBJECTS_SELECT =\n  "engagement_id, profile_id, profiles!engagement_members_profile_id_fkey(id, display_name)";',
    );
  });

  it("has no unhinted profiles embed anywhere in src", () => {
    const offenders = walk(SRC)
      .filter((path) => !path.endsWith("types.ts") && !path.endsWith("embed-hints.test.ts"))
      .flatMap((path) =>
        readFileSync(path, "utf8")
          .split("\n")
          .map((line, index) => ({ path, line, no: index + 1 }))
          .filter(({ line }) => /(?<!!)\bprofiles\(/.test(line))
          .map(({ path: p, no }) => `${p}:${no}`),
      );
    expect(offenders).toEqual([]);
  });
});

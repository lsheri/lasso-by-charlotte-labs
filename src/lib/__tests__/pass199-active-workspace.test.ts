import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(join(process.cwd(), dir))) {
    const rel = `${dir}/${entry}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) out.push(...walk(rel));
    else out.push(rel);
  }
  return out;
}

describe("pass 199 - the client tells the database which workspace it is in", () => {
  it("writes the choice to user_active_profile", () => {
    expect(read("src/hooks/use-profile.ts")).toContain("user_active_profile");
  });

  it("awaits the switch before invalidating the cache", () => {
    const source = read("src/components/layout/OrgSwitcher.tsx");
    const awaited = source.indexOf("await setActiveProfileId");
    const invalidated = source.indexOf("invalidateQueries");
    expect(awaited).toBeGreaterThan(-1);
    expect(invalidated).toBeGreaterThan(awaited);
  });

  it("keeps fetchProfileState listing every workspace unfiltered", () => {
    const source = read("src/hooks/use-profile.ts");
    const start = source.indexOf("export async function fetchProfileState");
    const body = source.slice(start, source.indexOf("function pickActive"));
    expect(body).not.toContain('eq("org_id"');
    expect(body).not.toContain("user_active_profile");
  });

  it("keeps the active-profile predicate out of application code", () => {
    for (const file of [...walk("src/hooks"), ...walk("src/pages")]) {
      expect(read(file)).not.toContain("is_my_active_profile");
    }
  });
});

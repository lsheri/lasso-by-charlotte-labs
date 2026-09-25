import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "src/components/marketing/archive/landing-2026-09-25";
const ROUTE = "src/routes/_authenticated/archive.landing-2026-09-25.tsx";

describe("unit D landing archive", () => {
  it("route is noindex and signed-in only", () => {
    const route = readFileSync(ROUTE, "utf8");
    expect(route).toContain('{ name: "robots", content: "noindex,nofollow" }');
    expect(route).toContain('createFileRoute("/_authenticated/archive/landing-2026-09-25")');
  });

  it("archived components carry no telemetry and send nothing", () => {
    const src = readFileSync(`${DIR}/ArchivedB2BLanding.tsx`, "utf8");
    for (const bad of [
      "recordAnonymousEventFn", "recordEvent", "logEvent", "posthog", "SessionReplay",
      "landing.", "notePlacedPilotClick", "noteUseCasePlayed", "submitPilotRequestFn", "useServerFn", "fetch(",
    ]) expect(src).not.toContain(bad);
    expect(src).toContain("event.preventDefault();");
  });

  it("archive.css has only scoped selectors and suffixed keyframes", () => {
    const css = readFileSync(`${DIR}/archive.css`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const selectors = [...css.matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{/g)].map((m) => m[1]!.trim());
    const ruleSelectors = selectors.filter((s) => !/^(from|to|\d+%)/.test(s) && !/^[\d.%,\s]+$/.test(s));
    expect(ruleSelectors.length).toBeGreaterThan(100);
    for (const group of ruleSelectors)
      for (const s of group.split(",")) expect(s).toContain(".landing-archive-2026-09-25");
    for (const m of css.matchAll(/@keyframes\s+([\w-]+)/g)) expect(m[1]).toMatch(/-archived-2026-09-25$/);
  });

  it("leaves the live landing and global styles untouched", () => {
    const changed = execSync("git diff --name-only HEAD -- src/styles.css src/components/marketing/B2BLanding.tsx", { encoding: "utf8" }).trim();
    expect(changed).toBe("");
  });
});

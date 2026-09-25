import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const DIR = "src/components/marketing/archive/landing-2026-09-25";
const ROUTE = "src/routes/landing-archive.2026-09-25.tsx";

describe("unit D landing archive", () => {
  it("route is noindex and signed-in only", () => {
    const route = readFileSync(ROUTE, "utf8");
    expect(route).toContain('{ name: "robots", content: "noindex,nofollow" }');
    expect(route).toContain('createFileRoute("/landing-archive/2026-09-25")');
  });

  it("route is top-level, not under _authenticated, and sends signed-out users to /auth", () => {
    expect(ROUTE.startsWith("src/routes/_authenticated/")).toBe(false);
    expect(existsSync("src/routes/_authenticated/archive.landing-2026-09-25.tsx")).toBe(false);
    const route = readFileSync(ROUTE, "utf8");
    expect(route).toContain("ssr: false");
    expect(route).toContain('supabase.auth.getUser()');
    expect(route).toContain('if (!data.user) throw redirect({ to: "/auth" });');
    expect(route.indexOf('if (!data.user)')).toBeGreaterThan(-1);
    expect(route).not.toContain('if (data.user) throw redirect');
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

  it("resets filter to none where 196f5296 set no filter, before the archived rules", () => {
    const css = readFileSync(`${DIR}/archive.css`, "utf8");
    const old = execSync("git show 196f5296:src/styles.css", { encoding: "utf8" });
    const firstLayer = css.indexOf("@layer nb {");
    for (const sel of [".lw-step", '.lw-step[data-active="true"]']) {
      const esc = sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const oldRule = old.match(new RegExp(`(?:^|\\n)${esc}\\s*\\{([^}]*)\\}`));
      expect(oldRule?.[1] ?? "").not.toMatch(/(^|[;\s])filter\s*:/);
      const reset = css.indexOf(`.landing-archive-2026-09-25 ${sel} { filter: none; }`);
      expect(reset).toBeGreaterThan(-1);
      expect(reset).toBeLessThan(firstLayer);
    }
    // .landing-close-line2 DID set a filter in 196f5296 (blur that resolves), so it keeps that, not none.
    expect(old).toMatch(/\n\.landing-close-line2 \{[^}]*filter: blur\(10px\)/);
    expect(css).toMatch(/\.landing-archive-2026-09-25 \.landing-close-line2 \{[^}]*filter: blur\(10px\)/);
    expect(css).not.toContain(".landing-archive-2026-09-25 .landing-close-line2 { filter: none; }");
  });
});

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

// workspace.affiliated must only ever be emitted by a server path that wrote
// a row, because the cohort count is evidence.

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const redeem = () => read("src/lib/activation-keys.functions.ts");

/** The recordEvent call for workspace.affiliated, from `recordEvent(` to its closing `});`. */
function affiliatedCall(src: string): string {
  const at = src.indexOf('eventType: "workspace.affiliated"');
  expect(at).toBeGreaterThan(-1);
  const start = src.lastIndexOf("recordEvent(", at);
  const end = src.indexOf("});", at);
  return src.slice(start, end + 3);
}

describe("pass 217: workspace.affiliated has one server-side call site", () => {
  it("the affiliation module holds neither client-callable affiliation function", () => {
    const src = read("src/lib/affiliation.functions.ts");
    expect(src).not.toContain("affiliateWorkspaceFn");
    expect(src).not.toContain("noteAffiliatedFn");
  });

  it("the redemption server function records workspace.affiliated", () => {
    expect(redeem()).toContain('"workspace.affiliated"');
  });

  it("the event sits inside a strict redeemed-only branch", () => {
    // Structural check, not a tautology: the call must be textually enclosed
    // by an `if (reason === "redeemed")` block, and nothing between that
    // guard and the call may widen it (no ||, no already_redeemed, no base.ok).
    const src = redeem();
    const guard = src.indexOf('if (reason === "redeemed") {');
    const call = src.indexOf('eventType: "workspace.affiliated"');
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(call);
    const between = src.slice(guard, call);
    expect(between).not.toContain("||");
    expect(between).not.toContain("already_redeemed");
    expect(between).not.toContain("}"); // still inside the guard's block
    expect(src.match(/"workspace\.affiliated"/g)?.length).toBe(1);
  });

  it("every dim the redemption path passes is allowlisted for the event", () => {
    const allow = read("src/lib/event-dim-allowlist.ts").match(
      /"workspace\.affiliated":\s*\[([^\]]*)\]/,
    );
    expect(allow).not.toBeNull();
    const allowed = [...allow![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const dims = affiliatedCall(redeem()).match(/dims:\s*\{([^}]*)\}/);
    expect(dims).not.toBeNull();
    const passed = dims![1]
      .split(",")
      .map((s) => s.split(":")[0].trim())
      .filter(Boolean);
    expect(passed.length).toBeGreaterThan(0);
    for (const d of passed) expect(allowed).toContain(d);
  });
});

// C1 part 2 (17 Nov 2026): keyboard focus outlines inside the app read --focus-ring, with --nb-green kept as the fallback.
import { describe, expect, it } from "vitest";
import { readStyles } from "@/design/stylesheet";

const css = readStyles();

/** Each rule whose selector has :focus-visible and whose body draws an outline in --nb-green with no job token in front. */
function bareGreenFocusRules(): string[] {
  const out: string[] = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [selector = "", body = ""] = [m[1]?.trim(), m[2]];
    if (selector.includes(":focus-visible") && /outline:[^;]*solid var\(--nb-green\)/.test(body))
      out.push(selector);
  }
  return out;
}

describe("focus rings read --focus-ring", () => {
  it("moves the 13 in-app focus outlines, each keeping --nb-green as its fallback", () => {
    expect(css.match(/solid var\(--focus-ring, var\(--nb-green\)\)/g)).toHaveLength(13);
  });

  it("leaves only the tour card, which sits outside the app shell, on bare --nb-green", () => {
    expect(bareGreenFocusRules()).toEqual([".tour-preview-card:focus-visible"]);
  });
});

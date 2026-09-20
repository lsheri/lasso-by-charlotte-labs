import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * C3: a judgment is a decision, never a call. This scans user-facing copy only:
 * JSX text and quoted copy strings, with word boundaries, so identifiers such as
 * useCallback, call_text or onCall never trip it.
 */
const FILES = [
  "src/pages/DecisionsPage.tsx",
  "src/components/decisions/DecisionLogRow.tsx",
  "src/components/decisions/DecisionCard.tsx",
  "src/components/decisions/AddDecisionDialog.tsx",
  "src/components/decisions/EngagementDecisions.tsx",
  "src/components/oneonone/ConfirmedCalls.tsx",
  "src/components/overview/WaitingOnYou.tsx",
  "src/components/work/work-buckets.ts",
  "src/components/work/TranscriptsAction.tsx",
];

const BANNED = /(^|[^A-Za-z_-])calls?([^A-Za-z_-]|$)/i;

/** A quoted run that reads like a sentence, not a class name or an id. */
function copyStrings(source: string): string[] {
  const out: string[] = [];
  const quoted = source.match(/"[^"\n]*"|'[^'\n]*'/g) ?? [];
  for (const raw of quoted) {
    const text = raw.slice(1, -1);
    if (!/[A-Za-z]/.test(text)) continue;
    // Skip import paths, class name soups, tokens and test ids.
    if (/^[@./]/.test(text)) continue;
    if (/[[\]{}<>#]/.test(text)) continue;
    if (/^[a-z0-9-]+(:[a-z0-9-]+)*$/.test(text) && !text.includes(" ")) continue;
    if (/(^|\s)(text|bg|border|flex|grid|mt|mb|px|py|gap|font|rounded|w|h)-/.test(text)) continue;
    out.push(text);
  }
  return out;
}

/** Text between JSX tags, which is always copy. */
function jsxText(source: string): string[] {
  return (source.match(/>\s*[A-Z][^<>{}\n]{2,}\s*</g) ?? []).map((m) => m.slice(1, -1).trim());
}

describe("C3 the word decision", () => {
  for (const file of FILES) {
    it(`${file} never calls a decision a call`, () => {
      const source = readFileSync(join(process.cwd(), file), "utf8");
      const copy = [...copyStrings(source), ...jsxText(source)];
      const offenders = copy.filter((line) => BANNED.test(line));
      expect(offenders).toEqual([]);
    });
  }

  it("does not trip on identifiers", () => {
    expect(BANNED.test("const x = useCallback(() => {});")).toBe(false);
    expect(BANNED.test("decision.call_text")).toBe(false);
    expect(BANNED.test("Confirm this call")).toBe(true);
  });
});

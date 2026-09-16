import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const route = readFileSync("src/routes/landing-next.tsx", "utf8");
const copySource = route.replace(/className="[^"]*"/g, "").toLowerCase();
const requiredReportHeadline = "a note in the margin, not a report on you";
const copyWithoutRequiredHeadline = copySource.replace(requiredReportHeadline, "");

const BANNED = [
  "monitor",
  "track",
  "tracking",
  "score",
  "grade",
  "surveillance",
  "oversight",
  "report on",
  "observability",
  "trace",
];

describe("pass L1 hidden landing route", () => {
  it("keeps banned language out except for the required coach headline", () => {
    for (const word of BANNED) {
      expect(copyWithoutRequiredHeadline).not.toContain(word);
    }
    expect(copySource).toContain(requiredReportHeadline);
  });

  it("has no em dashes in page strings", () => {
    expect(route).not.toContain("\u2014");
  });

  it("shows variant B only when v=b", () => {
    expect(route).toContain('search.v === "b"');
    expect(route).toContain('variant === "b"');
    expect(route.match(/Your firm bought AI\. Now nobody can say where a number came from\./g)).toHaveLength(1);
  });

  it("is hidden from indexing and navigation", () => {
    expect(route).toContain('{ name: "robots", content: "noindex, nofollow" }');
    expect(route).not.toContain('to="/landing-next"');
  });

  it("reuses the existing event with additive dimensions", () => {
    expect(route).toContain('event_type: "landing.viewed"');
    expect(route).toContain('dims: { variant, surface: "landing-next" }');
  });

  it("keeps stable clip slots for the next media pass", () => {
    for (const id of ["inbox", "find-it", "decisions", "coach-note", "one-on-one"]) {
      expect(route).toContain(`id=\"${id}\"`);
    }
  });
});
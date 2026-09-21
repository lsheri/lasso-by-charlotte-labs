import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { formatDate } from "@/lib/work-types";
import { resolveWorkDate } from "@/lib/work-order";
import { stampDate } from "@/components/work/card-stamp";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return entry === "__tests__" ? [] : files(path);
    return path.endsWith(".tsx") || path.endsWith(".ts") ? [path] : [];
  });
}

describe("w8 · one date rule", () => {
  it("has no component formatting a work item's date from a stored field", () => {
    // The wrong thing, stated as shapes rather than dates: a formatter reading
    // the arrival field, or a call site re-deriving the resolution order.
    const wrong = [
      /(?:formatDate|stampDate|arrivalWhen)\([^)]*captured_at/,
      /created_at_source\s*\?\?/,
    ];
    const offenders = files("src/components").filter((path) => {
      const source = readFileSync(path, "utf8");
      return wrong.some((pattern) => pattern.test(source));
    });
    expect(offenders).toEqual([]);
  });

  it("renders the date the ordering used, never the arrival", () => {
    const item = {
      work_date: "2026-09-17",
      created_at_source: null,
      captured_at: "2026-09-21T04:00:00.000Z",
    };
    const resolved = resolveWorkDate(item);
    for (const render of [formatDate, stampDate]) {
      expect(render(resolved.iso)).not.toBe(render(item.captured_at));
    }
  });

  it("reads a calendar date as the day it names, wherever the reader sits", () => {
    // A date-only value has no time of day, so it must not slide a day when a
    // reader is behind UTC. Derived from the value, never a written-out date.
    const day = "2026-09-17";
    const expected = new Date(2026, 8, 17);
    expect(formatDate(day)).toBe(
      expected.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
    );
    expect(stampDate(day)).toBe(
      `${String(expected.getDate()).padStart(2, "0")} ${expected
        .toLocaleString("en-US", { month: "short" })
        .toUpperCase()}`,
    );
  });
});

// @vitest-environment node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Pass 120: one event, one name, one write path. The underscore duplicates of
 * the canonical mapping and capture events must not exist in source.
 */
const BANNED = ["work_item" + ".mapped", "work_item" + ".captured"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "__tests__" || entry === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("pass120 telemetry taxonomy", () => {
  it("has no underscore duplicate event names anywhere in src", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const text = readFileSync(file, "utf8");
      for (const name of BANNED) if (text.includes(name)) offenders.push(`${file}: ${name}`);
    }
    expect(offenders).toEqual([]);
  });

  it("routes the mapping action through logEvent with the canonical name", () => {
    const text = readFileSync("src/lib/workflow-order.ts", "utf8");
    expect(text).toContain('logEvent("workitem.mapped"');
  });

  it("routes the capture action through logEvent with the canonical name", () => {
    const text = readFileSync("src/components/work/PasteThreadDialog.tsx", "utf8");
    expect(text).toContain('logEvent("workitem.captured"');
  });
});

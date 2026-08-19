import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { computeStepOrder, composeMembership } from "@/lib/engagement-page-shared";

const SRC = join(process.cwd(), "src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.tsx?$/.test(entry) ? [full] : [];
  });
}

const files = walk(SRC).filter((f) => !f.endsWith("routeTree.gen.ts"));
const sources = files.map((file) => ({ file, text: readFileSync(file, "utf8") }));

/** Every first key literal that some query actually subscribes to. */
function subscribedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const { text } of sources) {
    for (const match of text.matchAll(/queryKey:\s*\[\s*"([^"]+)"/g)) keys.add(match[1] as string);
    for (const match of text.matchAll(/return\s*\[\s*"([^"]+)"[^\]]*\]\s*as const/g))
      keys.add(match[1] as string);
    // Passthrough slices pass their key as a positional array argument.
    for (const match of text.matchAll(/^\s*\[\s*"([^"]+)",[^\]]*\],\s*$/gm))
      keys.add(match[1] as string);
  }
  return keys;
}

/** Every first key literal some call site invalidates. */
function invalidatedKeys(): { key: string; file: string }[] {
  const out: { key: string; file: string }[] = [];
  for (const { file, text } of sources) {
    for (const match of text.matchAll(/invalidateQueries\(\{\s*queryKey:\s*\[\s*"([^"]+)"/g))
      out.push({ key: match[1] as string, file });
  }
  return out;
}

describe("query key invalidation contract", () => {
  it("never invalidates a key literal that no query subscribes to", () => {
    const subscribed = subscribedKeys();
    const orphans = invalidatedKeys().filter((entry) => !subscribed.has(entry.key));
    expect(orphans).toEqual([]);
  });

  it("keeps the consolidated engagement payload under the engagement prefix", () => {
    const hook = readFileSync(join(SRC, "hooks/use-engagement-page.ts"), "utf8");
    expect(hook).toContain('["engagement", engagementId, profileId ?? null]');
  });

  it("keeps the old engagement page keys subscribed", () => {
    const subscribed = subscribedKeys();
    for (const key of [
      "engagement",
      "engagement-tasks",
      "engagement-coaches",
      "engagement-membership",
      "engagement-step-order",
      "decisions",
      "reflect-sessions",
      "reflect-messages",
      "work-items",
    ]) {
      expect(subscribed.has(key)).toBe(true);
    }
  });
});

describe("engagement payload helpers", () => {
  it("ranks a decision by its earliest cited step", () => {
    const order = computeStepOrder([
      {
        id: "t1",
        name: "One",
        owner_id: "p",
        detail: null,
        work_item_tasks: [
          { step_no: 2, step_confirmed: true, work_items: { id: "w1" } as never },
          { step_no: 1, step_confirmed: true, work_items: { id: "w2" } as never },
        ],
      },
      {
        id: "t2",
        name: "Two",
        owner_id: "p",
        detail: null,
        work_item_tasks: [{ step_no: 1, step_confirmed: true, work_items: { id: "w1" } as never }],
      },
    ]);
    expect(order["w2"]).toBeLessThan(order["w1"] as number);
    expect(order["w1"]).toBe(2);
  });

  it("reads membership from the caller's own rows only", () => {
    expect(composeMembership([{ member_role: "coach" }])).toEqual({
      isMember: false,
      isCoachMember: true,
    });
    expect(composeMembership([{ member_role: "em" }])).toEqual({
      isMember: true,
      isCoachMember: false,
    });
  });
});

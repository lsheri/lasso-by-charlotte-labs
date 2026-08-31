import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { navGroups } from "@/components/layout/nav-config";
import {
  SPIRAL_BASE_MS,
  SPIRAL_MAX_MS,
  SPIRAL_PER_ITEM_MS,
  SPIRAL_STAGGER_MS,
  SPIRAL_TURNS,
  spiralDurationMs,
  spiralStaggerMs,
  spiralStartFor,
} from "@/components/work/pile-spiral";
import { AVATAR_COLORS, avatarColorFor, initialsOf, kindChipTint } from "@/lib/card-meta";
import { PAST_WORK_GROUP_LABEL, PAST_WORK_NAV_LABEL } from "@/lib/past-work-shared";

describe("pass 142: your organization", () => {
  it("renames the nav group and keeps Past work", () => {
    expect(PAST_WORK_GROUP_LABEL).toBe("Your organization");
    expect(PAST_WORK_NAV_LABEL).toBe("Past work");
    const group = navGroups.find((g) => g.label === "Your organization");
    expect(group?.items[0]?.label).toBe("Past work");
    expect(navGroups.some((g) => g.label === "Firm")).toBe(false);
  });

  it("reads the group label as the archive micro label", () => {
    const page = readFileSync("src/pages/ArchivePage.tsx", "utf8");
    expect(page).toContain(`<p className="micro-label">{PAST_WORK_GROUP_LABEL}</p>`);
  });
});

describe("pass 142: metadata sub-card", () => {
  it("tints kind chips by kind, with no reds", () => {
    expect(kindChipTint({ deliverable_kind: "deck" }, null).background).toBe("#faf1e2");
    expect(kindChipTint({ deliverable_kind: "deck" }, null).color).toBe("var(--nb-amber)");
    expect(kindChipTint({ deliverable_kind: "proposal" }, null).background).toBe("#e7efe9");
    expect(kindChipTint({ deliverable_kind: "proposal" }, null).color).toBe(
      "var(--nb-green-deep)",
    );
    expect(kindChipTint({ deliverable_kind: "model_or_budget" }, null).background).toBe("#e8f0fb");
    expect(kindChipTint(null, "sheet").color).toBe("var(--nb-blue)");
    expect(kindChipTint({ deliverable_kind: "memo_or_report" }, null)).toEqual({
      background: "var(--nb-grey-2)",
      color: "var(--nb-graphite)",
    });
    expect(kindChipTint(null, "whatever").background).toBe("var(--nb-grey-2)");
  });

  it("picks avatar colours deterministically from the profile id", () => {
    const first = avatarColorFor("profile-abc");
    expect(avatarColorFor("profile-abc")).toBe(first);
    expect(AVATAR_COLORS).toContain(first);
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      expect(AVATAR_COLORS).toContain(avatarColorFor(id));
    }
  });

  it("reads two initials", () => {
    expect(initialsOf("Ada Lovelace")).toBe("AL");
    expect(initialsOf("Prince")).toBe("PR");
    expect(initialsOf(null)).toBe("?");
  });
});

describe("pass 142: spiral settle", () => {
  it("pins the tunables", () => {
    expect(SPIRAL_BASE_MS).toBe(1600);
    expect(SPIRAL_PER_ITEM_MS).toBe(120);
    expect(SPIRAL_MAX_MS).toBe(6000);
    expect(SPIRAL_TURNS).toBe(1.25);
    expect(SPIRAL_STAGGER_MS).toBe(40);
  });

  it("clamps the duration formula", () => {
    expect(spiralDurationMs(5)).toBe(1600 + 5 * 120);
    expect(spiralDurationMs(100)).toBe(6000);
    expect(spiralDurationMs(36)).toBeLessThanOrEqual(6000);
  });

  it("compresses the stagger so the last card lands inside the cap", () => {
    for (const n of [1, 5, 36, 100, 400]) {
      const total = spiralDurationMs(n);
      const stagger = spiralStaggerMs(n);
      const last = spiralStartFor("id-last", n - 1, n, 900);
      expect(last.delayMs + last.durationMs).toBeLessThanOrEqual(total);
      expect(stagger).toBeLessThanOrEqual(SPIRAL_STAGGER_MS);
    }
  });

  it("starts each card off the pile, seeded by id", () => {
    const a = spiralStartFor("work-1", 0, 10, 1000);
    expect(spiralStartFor("work-1", 0, 10, 1000)).toEqual(a);
    expect(Math.hypot(a.dx, a.dy)).toBeGreaterThan(50);
    expect(spiralStartFor("work-2", 0, 10, 1000)).not.toEqual(a);
  });
});

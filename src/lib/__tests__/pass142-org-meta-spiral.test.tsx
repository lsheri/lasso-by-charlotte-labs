import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import { navGroups } from "@/components/layout/nav-config";
import { AVATAR_COLORS, avatarColorFor, initialsOf, kindChipTint } from "@/lib/card-meta";
import { PAST_WORK_GROUP_LABEL, PAST_WORK_NAV_LABEL } from "@/lib/past-work-shared";

describe("pass 142: your organization", () => {
  it("renames the nav group and keeps Past work", () => {
    // Nav is now ordered by the weekly loop rather than by object type.
    expect(PAST_WORK_GROUP_LABEL).toBe("Where it goes");
    expect(PAST_WORK_NAV_LABEL).toBe("Past work");
    const group = navGroups.find((g) => g.label === "Where it goes");
    expect(group?.items[0]?.label).toBe("Past work");
    expect(navGroups.some((g) => g.label === "Firm")).toBe(false);
  });

  // Updated for Figma 29:833: the frame drops the repeated group stamp from the
  // page, so the agreement between nav and page is now the page's own title.
  it("names the page the same thing the nav group names it", () => {
    const page = readFileSync("src/pages/ArchivePage.tsx", "utf8");
    expect(page).toContain('<PageHeader title="Past" italicWord="work"');
    expect(page).not.toContain('className="micro-label"');
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


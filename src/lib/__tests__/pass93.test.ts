import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  groupEngagementsByClient,
  isSyntheticShelf,
  INTERNAL_SHELF_ID,
  UNMAPPED_SHELF_ID,
  UNMAPPED_SHELF_NAME,
  type NavEngagement,
} from "@/lib/nav-groups";

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

const eng = (id: string, code: string, clients?: NavEngagement["clients"]): NavEngagement => ({
  id,
  code,
  title: `T${id}`,
  ...(clients ? { clients } : {}),
});

describe("93.1 questions are stamped and read where they happened", () => {
  it("stamps the coach question with the engagement it was asked in", () => {
    const source = read("src/lib/coach-chat-run.server.ts");
    expect(source).toMatch(/query_log[\s\S]{0,200}engagement_id: data\.engagement_id/);
  });

  it("stamps a reflect question only when the scope named one target", () => {
    const source = read("src/lib/reflect-run.server.ts");
    expect(source).toContain('engagement_id: input.scopeMode === "engagements" ? single : null');
    expect(source).toContain('work_item_id: input.scopeMode === "items" ? single : null');
    expect(source).toContain("ids.length === 1 ? ids[0]! : null");
  });

  it("reads questions for one engagement only", () => {
    const source = read("src/hooks/use-subject-coaching.ts");
    expect(source).toContain('.eq("engagement_id", engagementId)');
    expect(source).toContain("useQueriesAboutMe(subjectId: string | undefined, engagementId: string)");
    expect(read("src/components/coaching/SubjectCoachingSection.tsx")).toContain(
      "useQueriesAboutMe(profileId, engagementId)",
    );
  });

  it("shows in a peek only the questions asked about that piece of work", () => {
    const source = read("src/components/peek/AiReads.tsx");
    expect(source).toContain('.eq("work_item_id", workItemId)');
    expect(source).toContain("workItemId={workItemId}");
  });

  it("says owner wide facts in owner wide words", () => {
    const source = read("src/components/common/CaptureCoverage.tsx");
    expect(source).toContain("Connected across your record:");
    expect(source).toContain("Across your record,");
  });
});

describe("93.2 sidebar hierarchy", () => {
  const nav = read("src/components/layout/SidebarNav.tsx");

  it("marks a shelf with the folder glyph and a state chevron", () => {
    expect(nav).toMatch(/nb-nav-shelf[\s\S]{0,400}name="engagement" size=\{16\}/);
    expect(nav).toMatch(/name="chevron-right"\s*\n\s*size=\{13\}/);
    expect(nav).toContain('className={collapsed ? "" : "rotate-90"}');
    expect(nav).toContain("aria-expanded");
  });

  it("marks nested engagement rows with a static chevron", () => {
    expect(nav).toContain('name={nested ? "chevron-right" : "engagement"}');
    expect(nav).toContain("size={nested ? 14 : 16}");
    expect(nav).toContain("nb-nav-item-nested");
  });

  it("counts only the synthetic shelves", () => {
    expect(nav).toContain("isSyntheticShelf(shelf.clientId)");
    expect(isSyntheticShelf(INTERNAL_SHELF_ID)).toBe(true);
    expect(isSyntheticShelf(UNMAPPED_SHELF_ID)).toBe(true);
    expect(isSyntheticShelf("c1")).toBe(false);
  });

  it("drops the Folder code label inside the Unmapped shelf", () => {
    expect(nav).toContain("hideCode={shelf.clientId === UNMAPPED_SHELF_ID}");
  });

  it("leaves the coach nav flat", () => {
    expect(nav).toMatch(/coachNavGroups\.map/);
    expect(nav).not.toMatch(/coachNavGroups[\s\S]{0,600}nb-nav-shelf/);
  });
});

describe("93.3 the Unmapped shelf", () => {
  it("holds quick folders and renders last", () => {
    const { groups, flat } = groupEngagementsByClient([
      eng("q", "Q1", { id: "qf", name: "Quick", quick_folder: true }),
      eng("i", "I1"),
      eng("z", "Z1", { id: "c1", name: "Zeta", quick_folder: false }),
      eng("a", "A1", { id: "c2", name: "Acme", quick_folder: false }),
    ]);
    expect(flat).toEqual([]);
    expect(groups.map((g) => g.name)).toEqual(["Acme", "Zeta", "Internal", UNMAPPED_SHELF_NAME]);
    expect(groups.at(-1)?.engagements.map((e) => e.id)).toEqual(["q"]);
  });

  it("renders neither synthetic shelf when it would be empty", () => {
    const { groups } = groupEngagementsByClient([
      eng("z", "Z1", { id: "c1", name: "Zeta", quick_folder: false }),
    ]);
    expect(groups.map((g) => g.clientId)).toEqual(["c1"]);
  });
});

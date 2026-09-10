import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { checkApplies } from "@/lib/firm-checks.server";
import {
  INTERNAL_SHELF_ID,
  INTERNAL_SHELF_NAME,
  groupEngagementsByClient,
  type NavEngagement,
} from "@/lib/nav-groups";

const read = (path: string) => readFileSync(path, "utf8");

const eng = (
  id: string,
  code: string,
  clients: NavEngagement["clients"] = null,
): NavEngagement => ({ id, code, title: `Work ${code}`, clients });

describe("92.1 per check bubbles", () => {
  const bubbles = read("src/components/reflect/FirmCheckBubbles.tsx");
  const chips = read("src/components/reflect/ChatAnalyses.tsx");
  const lens = read("src/components/reflect/AnalysisLens.tsx");

  it("gives every bubble the accent treatment, never a green fill", () => {
    expect(bubbles).toContain("border-accent");
    expect(bubbles).toContain("bg-accent-soft");
    expect(bubbles).not.toContain("bg-green");
  });

  it("renders one bubble per active check plus a run all bubble", () => {
    expect(bubbles).toContain("checks.map((check)");
    expect(bubbles).toContain("Run all");
    expect(bubbles).toContain("checks.length > 1");
  });

  it("truncates a long check title rather than breaking the row", () => {
    expect(bubbles).toContain("truncate");
  });

  it("keeps the confirm step between picking a bubble and running", () => {
    expect(chips).toContain("setConfirming({");
    expect(chips).toContain("check: { id: check.id, title: check.title }");
    expect(lens).toContain("check: { id: check.id, title: check.title }");
  });

  it("sends only the check id to the server", () => {
    expect(chips).toContain("check_id: checkId");
    expect(lens).toContain("check_id: checkId");
  });
});

describe("92.1 server side single check", () => {
  const server = read("src/lib/analysis-run.server.ts");

  it("resolves the named check before any run row exists", () => {
    expect(server).toContain("resolveSingleCheck");
    expect(server).toContain("CHECK_UNAVAILABLE_LINE");
  });

  it("keeps a single check run apart from the run all result", () => {
    // Pass 95 moved the key into analysis-key; the check id still shapes it.
    expect(server).toContain("checkId: singleCheck && data.check_id ? data.check_id : null");
    expect(read("src/lib/analysis-key.ts")).toContain(":check:");
  });


  it("applies an org wide check anywhere", () => {
    expect(
      checkApplies(
        { engagement_id: null, subject_profile_id: null },
        { engagementIds: [], ownerProfileId: "p1" },
      ),
    ).toBe(true);
  });

  it("refuses an engagement check outside its engagement", () => {
    expect(
      checkApplies(
        { engagement_id: "e1", subject_profile_id: null },
        { engagementIds: ["e2"], ownerProfileId: "p1" },
      ),
    ).toBe(false);
  });

  it("refuses a person check for someone else's work", () => {
    expect(
      checkApplies(
        { engagement_id: null, subject_profile_id: "p2" },
        { engagementIds: [], ownerProfileId: "p1" },
      ),
    ).toBe(false);
  });
});

describe("92.2 shelf typography", () => {
  const styles = read("src/styles.css");
  const nav = read("src/components/layout/SidebarNav.tsx");

  it("gives shelf headers the micro label voice in muted text", () => {
    expect(styles).toContain(".nb-nav-shelf");
    expect(styles).toMatch(/\.nb-nav-shelf\s*{[^}]*var\(--nb-soft\)/);
    expect(styles).toMatch(/\.nb-nav-shelf\s*{[^}]*uppercase/);
  });

  it("keeps the chevron, collapse state and hover row on the header", () => {
    expect(nav).toContain("nb-nav-shelf");
    expect(nav).toContain("aria-expanded={!collapsed}");
    expect(nav).toContain('name="chevron-right"');
  });
});

describe("92.3 the Internal shelf", () => {
  it("groups clientless engagements under Internal, last", () => {
    const { groups, flat } = groupEngagementsByClient([
      eng("1", "A"),
      eng("2", "B", { id: "c1", name: "Zeta", quick_folder: false }),
      eng("3", "C", { id: "c2", name: "Acme", quick_folder: false }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["Acme", "Zeta", INTERNAL_SHELF_NAME]);
    expect(groups.at(-1)?.clientId).toBe(INTERNAL_SHELF_ID);
    expect(groups.at(-1)?.engagements.map((e) => e.id)).toEqual(["1"]);
    expect(flat).toEqual([]);
  });

  it("shelves quick folders under Unmapped, after Internal (pass 93)", () => {
    const { groups, flat } = groupEngagementsByClient([
      eng("q", "Q", { id: "qf", name: "Quick", quick_folder: true }),
      eng("1", "A"),
    ]);
    expect(flat).toEqual([]);
    expect(groups.map((g) => g.clientId)).toEqual([INTERNAL_SHELF_ID, "__unmapped__"]);
  });

  it("omits the Internal shelf when every engagement has a client", () => {
    const { groups } = groupEngagementsByClient([
      eng("2", "B", { id: "c1", name: "Zeta", quick_folder: false }),
    ]);
    expect(groups.map((g) => g.clientId)).toEqual(["c1"]);
  });
});

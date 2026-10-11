import { describe, expect, it } from "vitest";

import { navGroups, partnerNavGroups } from "@/components/layout/nav-config";

const BANNED =
  /\b(score|scored|scoring|monitor|monitoring|track|tracking|tracked|surveillance|oversight|governance|compliance|integrity|fluency|gaps|caught|telemetry|analytics)\b/i;

function flat(groups: typeof navGroups) {
  return groups.flatMap((g) => g.items.map((i) => i.to));
}

describe("partner navigation", () => {
  it("keeps every existing destination outside the partner coaching section", () => {
    for (const to of flat(navGroups.filter((group) => group.id !== "coach"))) expect(flat(partnerNavGroups)).toContain(to);
    expect(partnerNavGroups).toHaveLength(navGroups.length - 1);
  });

  it("changes only the two named headings in retained groups", () => {
    expect(partnerNavGroups).toHaveLength(navGroups.length - 1);
    const diffs: string[] = [];
    for (const [i, partner] of partnerNavGroups.entries()) {
      const group = navGroups.filter((group) => group.id !== "coach")[i];
      if (!group) throw new Error("group count drifted");
      expect(partner.id).toBe(group.id);
      // Partner-only additions under the engagements group.
      const extra =
        group.id === "engagements"
          ? [
              { label: "Workshop keys", to: "/requests", icon: "members" },
              { label: "Adding people", to: "/adding-people", icon: "members" },
            ]
          : [];
      expect(partner.items).toEqual([...group.items, ...extra]);
      expect(partner.emptyState).toEqual(group.emptyState);
      if (partner.label !== group.label) diffs.push(`${group.label} -> ${partner.label}`);
    }
    expect(diffs).toEqual(["Where it goes -> Your clients", "Run the firm -> Your practice"]);
  });

  it("omits Your coach for partners and retains it for company workspaces", () => {
    expect(partnerNavGroups.some((group) => group.id === "coach" || group.label === "Your coach")).toBe(false);
    expect(flat(partnerNavGroups)).not.toContain("/one-on-one");
    expect(flat(partnerNavGroups)).not.toContain("/coach-notes");
    expect(navGroups.find((group) => group.id === "coach")?.items.map((item) => item.label)).toEqual(["1:1 prep", "Notes from your coach"]);
  });

  it("adds no route and uses no forbidden word", () => {
    const navTos = new Set(flat(navGroups));
    for (const to of flat(partnerNavGroups))
      expect(navTos.has(to) || to === "/requests" || to === "/adding-people").toBe(true);
    for (const group of partnerNavGroups) {
      expect(group.label, group.label).not.toMatch(BANNED);
      expect(group.label).not.toContain("—");
    }
  });
});

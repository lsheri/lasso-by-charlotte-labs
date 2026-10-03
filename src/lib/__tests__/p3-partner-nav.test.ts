import { describe, expect, it } from "vitest";

import { navGroups, partnerNavGroups } from "@/components/layout/nav-config";

const BANNED =
  /\b(score|scored|scoring|monitor|monitoring|track|tracking|tracked|surveillance|oversight|governance|compliance|integrity|fluency|gaps|caught|telemetry|analytics)\b/i;

function flat(groups: typeof navGroups) {
  return groups.flatMap((g) => g.items.map((i) => i.to));
}

describe("partner navigation", () => {
  it("keeps every existing destination", () => {
    for (const to of flat(navGroups)) expect(flat(partnerNavGroups)).toContain(to);
    expect(partnerNavGroups).toHaveLength(navGroups.length);
  });

  it("changes only the two named headings", () => {
    expect(partnerNavGroups).toHaveLength(navGroups.length);
    const diffs: string[] = [];
    for (const [i, partner] of partnerNavGroups.entries()) {
      const group = navGroups[i];
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

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

/**
 * Pass 120: one event, one name, one write path.
 *
 * The underscore spellings ("work_item.mapped" / "work_item.captured") were a
 * second, PostHog-only emit for the same action. They are gone; these pins keep
 * them gone. The canonical mapping emit is logEvent("workitem.mapped").
 */

function grep(pattern: string): string[] {
  try {
    const out = execSync(`grep -rl -- ${JSON.stringify(pattern)} src`, {
      encoding: "utf8",
    });
    return out.split("\n").filter(Boolean);
  } catch {
    return [];
  }
}

const THIS_FILE = "src/lib/__tests__/pass120-taxonomy.test.ts";

describe("pass120 telemetry taxonomy", () => {
  it("has no work_item.mapped anywhere in src outside this pin", () => {
    expect(grep("work_item.mapped").filter((f) => f !== THIS_FILE)).toEqual([]);
  });

  it("has no work_item.captured anywhere in src outside this pin", () => {
    expect(grep("work_item.captured").filter((f) => f !== THIS_FILE)).toEqual([]);
  });

  it("keeps the dead names out of the v2 registry", () => {
    const registry = readFileSync("src/lib/telemetry-v2-shared.ts", "utf8");
    expect(registry).not.toContain("work_item.mapped");
    expect(registry).not.toContain("work_item.captured");
  });

  it("routes every mapping emit through logEvent with the canonical name", () => {
    const page = readFileSync("src/pages/WorkPage.tsx", "utf8");
    expect(page).toContain('import { MapDialog } from "@/components/work/MapDialog"');
    expect(page).toContain("<MapDialog");
    expect(page).toContain("item={mapItem}");
    expect(page).toContain("groupItems={mapGroup ?? undefined}");
    const dialog = readFileSync("src/components/work/MapDialog.tsx", "utf8");
    expect(dialog).toContain('import { remapItems } from "@/lib/workflow-order"');
    expect(dialog).toContain("const result = await remapItems({");
    expect(dialog).toContain("await mapToTask(data.id)");
    const sites = [
      "src/hooks/use-mapping-suggestions.ts",
      "src/lib/workflow-order.ts",
      "src/components/engagements/EngagementBriefSection.tsx",
    ];
    for (const site of sites) {
      const source = readFileSync(site, "utf8");
      expect(source).toContain('logEvent("workitem.mapped"');
    }
  });
});

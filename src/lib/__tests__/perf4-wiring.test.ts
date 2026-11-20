import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("PERF-4 wiring", () => {
  it("answers the Firm view counts without waiting for the view event, and still records it", () => {
    const source = read("src/lib/firm-dashboard.functions.ts");
    const handler = source.slice(source.indexOf("export const getFirmDashboard"), source.indexOf("export const getFirmCheckLibrary"));
    expect(handler).not.toMatch(/await recordEvent/);
    expect(handler).toMatch(/runAfterResponse\(\(\) =>\s*recordEvent\(supabaseAdmin, \{\s*eventType: "admin\.dashboard_viewed"/);
    // The event carries only what it carried before.
    expect(handler).toMatch(/dims: \{ panels_shown: dashboard\.panels_shown \}/);
  });

  it("writes a board's viewed row once per open, from the page only", () => {
    expect(read("src/routes/_authenticated/engagements.$id_.canvas-lab.tsx")).not.toMatch(/useRecordEngagementView\(/);
    expect(read("src/pages/CanvasLabPage.tsx").match(/useRecordEngagementView\(engagementId\)/g)).toHaveLength(1);
  });

  it("reads the firm record's item rows together, with the same filters as before", () => {
    const source = read("src/lib/firm-corpus.server.ts");
    const block = source.slice(source.indexOf("const [items, extracts, showings, exemplars"), source.indexOf("const peopleIds"));
    expect(block).toMatch(/Promise\.all\(\[/);
    expect(block).toMatch(/from\("work_items"\)\.select\("id, owner_id, type, title, display_title, visibility, work_date, meta"\)\.eq\("org_id", orgId\)/);
    expect(block).toMatch(/from\("client_showings"\)[^\n]*\.eq\("org_id", orgId\)/);
    expect(block).toMatch(/from\("engagement_members"\)\.select\("engagement_id"\)\.eq\("profile_id", asker\.id\)/);
  });

  it("still refuses a guest, a deactivated seat and a non-firm workspace in the firm gate", () => {
    const source = read("src/lib/firm-corpus.server.ts");
    const gate = source.slice(source.indexOf("export async function requireFirmMember"), source.indexOf("/** The raw rows"));
    expect(gate).toMatch(/if \(!me \|\| me\.is_guest \|\| me\.deactivated_at\) throw new Response\("Forbidden", \{ status: 403 \}\)/);
    expect(gate).toMatch(/if \(!hasFirmView\(settings\?\.\["type"\][^)]*\)\) throw new Response\("Forbidden", \{ status: 403 \}\)/);
  });

  it("uses the shared skeleton frame, not a loading word, on the slow sections", () => {
    for (const path of [
      "src/pages/FirmDashboardPage.tsx",
      "src/components/firm/FirmLiveBoards.tsx",
      "src/components/firm/FirmProposalsCard.tsx",
      "src/pages/ProposalsPage.tsx",
      "src/components/home/HomeProposals.tsx",
      "src/components/firm-brain/FirmBrainMap.tsx",
      "src/components/firm-brain/CommonQuestionsCard.tsx",
    ]) {
      const source = read(path);
      expect(source, path).toMatch(/<SkeletonFrame /);
      expect(source, path).not.toMatch(/>Counting\.<|>Loading\.</);
    }
  });
});

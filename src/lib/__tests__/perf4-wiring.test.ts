import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("PERF-4 wiring", () => {
  it("writes a board's viewed row once per open, from the page only", () => {
    expect(read("src/routes/_authenticated/engagements.$id_.canvas-lab.tsx")).not.toMatch(/useRecordEngagementView\(/);
    expect(read("src/pages/CanvasLabPage.tsx").match(/useRecordEngagementView\(engagementId\)/g)).toHaveLength(1);
  });

  it("reads the firm record and the firm gate one read after another, as before #273 (D-90)", () => {
    const source = read("src/lib/firm-corpus.server.ts");
    expect(source).not.toMatch(/Promise\.all/);
  });

  it("starts the Firm view cards after the counts, as before #273 (D-90)", () => {
    const source = read("src/pages/FirmDashboardPage.tsx");
    expect(source).not.toMatch(/useFirmViewWarmup|prefetchQuery/);
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

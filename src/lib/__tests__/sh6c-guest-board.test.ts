import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn(), bucket: () => "1" }));

import { applyDurableBoard } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkboardDto, WorkboardNodeDto } from "@/lib/canvas-lab-shared";

function node(extra: Partial<WorkboardNodeDto> & Record<string, unknown>): WorkboardNodeDto {
  return {
    id: "n1", frameId: null, kind: "work_item", workItemId: "w1", decisionId: null,
    authorProfileId: "host", authorName: "Host", title: "", body: "", judgmentType: null,
    x: 10, y: 20, w: 0, h: 0, hidden: false, version: 3, referenceReadable: true,
    ...extra,
  } as WorkboardNodeDto;
}

function board(nodes: WorkboardNodeDto[]): WorkboardDto {
  return { id: "b", engagementId: "e", version: 1, frames: [], nodes, links: [], viewerProfileId: "guest", canEditStructure: false, archivedContextFrame: null };
}

describe("SH-6c guest boards", () => {
  it("draws a durable work card with no seed entry from the readable item", () => {
    const out = applyDurableBoard({ frames: [], nodes: [] }, board([node({ itemTitle: "Market sizing", itemType: "deck", itemOwnerId: "host" })]));
    expect(out.nodes).toHaveLength(1);
    expect(out.nodes[0]).toMatchObject({ id: "work:w1", kind: "work", title: "Market sizing", typeLabel: "deck", ownership: "teammate", workItemId: "w1", durableId: "n1", x: 10, y: 20 });
  });

  it("keeps dropping a work card without readable item fields", () => {
    const out = applyDurableBoard({ frames: [], nodes: [] }, board([node({})]));
    expect(out.nodes).toHaveLength(0);
  });

  it("excludes guest profiles from the phone switcher list", async () => {
    const { switcherProfiles } = await import("@/components/layout/MobileTabBar");
    const list = switcherProfiles([{ id: "own" }, { id: "g", is_guest: true }, { id: "own2", is_guest: false }]);
    expect(list.map((p) => p.id)).toEqual(["own", "own2"]);
  });
});

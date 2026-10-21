// @vitest-environment jsdom
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SuggestedStructure } from "@/lib/structure-suggest-shared";

const mocks = vi.hoisted(() => ({ log: vi.fn(), resolve: vi.fn(), suggest: vi.fn(), move: vi.fn(), create: vi.fn() }));
vi.mock("@/lib/telemetry", () => ({ logEvent: mocks.log }));
vi.mock("@/lib/profile-resolve", () => ({ resolveProfile: mocks.resolve }));
vi.mock("@/lib/structure-suggest.server", () => ({ suggestStructures: mocks.suggest }));
vi.mock("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
vi.mock("@/lib/workstream-draw.functions", () => ({ createDrawnWorkstreamFn: mocks.create, moveItemToWorkstreamFn: mocks.move }));
vi.mock("@tanstack/react-start", async (original) => {
  const actual = await original<typeof import("@tanstack/react-start")>();
  return { ...actual, createServerFn: () => {
    const builder = { middleware: () => builder, inputValidator: () => builder, handler: (fn: unknown) => ({ __handler: fn }) };
    return builder;
  } };
});

import { applySuggestedStructure, removeSuggestedStructure, SuggestionApplyResult, type SuggestionRegionResult } from "@/pages/CanvasLabPage";
import { requireSuggestionProfile } from "@/lib/structure-suggest.functions";
import { SuggestStructurePanel } from "./SuggestStructurePanel";
import { createDrawnWorkstreamFn, moveItemToWorkstreamFn } from "@/lib/workstream-draw.functions";
import { logEvent } from "@/lib/telemetry";

const structure: SuggestedStructure = { id: "costs", cut: "workstream", title: "By cost pool", why: "Costs shape the decision.", regions: ["Warehouse cost", "Freight lanes", "Fleet leases"] };
afterEach(cleanup);
beforeEach(() => { vi.clearAllMocks(); mocks.create.mockImplementation(async ({ data }: { data: { name: string } }) => ({ id: data.name })); });

function Harness({ failAt = -1 }: { failAt?: number }) {
  const [regions, update] = useState<SuggestionRegionResult[]>([]);
  const [frames, setFrames] = useState<string[]>([]);
  return <>
    <output aria-label="Saved frames">{frames.join(", ")}</output>
    {regions.length === 0 ? <SuggestStructurePanel state="choosing" structures={[structure]} onSubmit={() => undefined} onCancel={() => undefined} onChoose={() => void applySuggestedStructure(structure, {
      createFrame: async (name, index) => {
        if (index === failAt) throw new Error("Unavailable");
        setFrames((previous) => [...previous, name]);
        return { id: name, name: "", x: 0, y: index * 500, width: 400, height: 300, durableId: name };
      },
      createWorkstream: (name) => createDrawnWorkstreamFn({ data: { engagement_id: "board", name } }),
      patchFrame: async () => undefined,
      created: () => logEvent("workboard.workstream_created", "org", { via: "suggested", claimed: 0 }),
      update,
    })} /> : <SuggestionApplyResult regions={regions} busy={false} message={null} onRemove={() => undefined} onClose={() => undefined} />}
  </>;
}

describe("suggestion apply and authorization", () => {
  it("creates named regions, records each workstream, and never moves cards", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Use this" }));
    await waitFor(() => expect(screen.getByText("Fleet leases: Added")).toBeTruthy());
    expect(screen.getByLabelText("Saved frames").textContent).toBe(structure.regions.join(", "));
    expect(mocks.create.mock.calls.map(([input]) => input.data.name)).toEqual(structure.regions);
    expect(mocks.log.mock.calls).toEqual(structure.regions.map(() => ["workboard.workstream_created", "org", { via: "suggested", claimed: 0 }]));
    expect(moveItemToWorkstreamFn).not.toHaveBeenCalled();
  });

  it("keeps the earlier region and visibly reports a mid-way failure without rollback", async () => {
    render(<Harness failAt={1} />);
    fireEvent.click(screen.getByRole("button", { name: "Use this" }));
    await waitFor(() => expect(screen.getByText("Freight lanes: Not added")).toBeTruthy());
    expect(screen.getByText("Warehouse cost: Added")).toBeTruthy();
    expect(screen.getByText("Fleet leases: Not started")).toBeTruthy();
    expect(screen.getByLabelText("Saved frames").textContent).toBe("Warehouse cost");
    expect(mocks.log).toHaveBeenCalledTimes(1);
    expect(mocks.move).not.toHaveBeenCalled();
  });

  it("retains a workstream and its frame if work arrived, removing only empty siblings", async () => {
    const deleteWorkstream = vi.fn(async (id: string) => { if (id === "occupied") throw new Error("Move its cards first."); });
    const archiveFrame = vi.fn(async (_frame: unknown) => undefined);
    const results: SuggestionRegionResult[] = ["occupied", "empty"].map((id) => ({ name: id, taskId: id, status: "saved", frame: { id, name: id, x: 0, y: 0, width: 400, height: 300 } }));
    const result = await removeSuggestedStructure(results, { hasCards: () => false, deleteWorkstream, archiveFrame });
    render(<SuggestionApplyResult regions={result.remaining} busy={false} message={result.message} onRemove={() => undefined} onClose={() => undefined} />);
    expect(screen.getByRole("status").textContent).toContain("occupied stayed because it has work.");
    expect(result.remaining.map((region) => region.taskId)).toEqual(["occupied"]);
    expect(archiveFrame).toHaveBeenCalledTimes(1);
    expect(archiveFrame.mock.calls[0]?.[0]).toEqual(results[1]?.frame);
  });

  it("refuses a caller without a profile in the board workspace without generating or emitting an event", async () => {
    mocks.resolve.mockResolvedValue(null);
    const boardQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn(async () => ({ data: { org_id: "board-org" }, error: null })) };
    const supabase = { from: vi.fn(() => boardQuery) };
    await expect(requireSuggestionProfile({ supabase: supabase as never, userId: "caller" }, "board")).rejects.toThrow("This board is not available to you.");
    expect(mocks.resolve).toHaveBeenCalledWith(supabase, "caller", undefined, "board-org");
    expect(mocks.suggest).not.toHaveBeenCalled();
    expect(mocks.log).not.toHaveBeenCalled();
  });
});
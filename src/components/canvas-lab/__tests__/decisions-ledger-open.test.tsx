// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { DecisionLine } from "@/hooks/use-decision-lines";
import type { WorkItemRow } from "@/lib/work-types";
const h = vi.hoisted(() => ({ lines: [] as DecisionLine[] }));
vi.mock("@/hooks/use-decision-lines", async (original) => ({ ...await original<object>(), useDecisionLines: () => ({ data: h.lines, isLoading: false, isError: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: [{ id: "v", version_no: 3, created_at: "2026-10-26", source_event: "mcp_repush" }], error: null }) }) }) }) } }));
import { DecisionsLedger } from "../DecisionsLedger";
import { LabCardMenu } from "../LabCardMenu";
import { noteWorkboardLedgerOpened } from "../canvas-lab-telemetry";
import { logEvent } from "@/lib/telemetry";
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
const item: WorkItemRow = { id: "d", title: "Pricing decisions", type: "document", doc_kind: "decisions", source: "mcp:push", visibility: "unmapped", captured_at: "2026-10-26", content_ref: "d.md", work_item_tasks: [] };
afterEach(() => { cleanup(); h.lines = []; vi.clearAllMocks(); });
function opening(target: WorkItemRow) {
  const source = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const start = source.indexOf("  function openNode(");
  const body = source.slice(source.indexOf("{", start) + 1, source.indexOf("\n  /* ---------------- B4", start)).replace(/\n  }\s*$/, "").replace(' as "document" | "deck" | "sheet"', "");
  const ledger = vi.fn(), review = vi.fn(), event = vi.fn();
  const run = new Function("itemByNode", "setFocusOrigin", "setLedgerId", "noteWorkboardLedgerOpened", "orgId", "filePreviews", "viewedPreviewIdsRef", "noteWorkboardCardContentViewed", "isDeliverableType", "setReviewId", "noteWorkboardReviewOpened", "setFocusId", "node", "origin", "via", body);
  run(() => target, vi.fn(), ledger, event, "o", {}, { current: new Set() }, vi.fn(), (type: string) => type === "document", review, vi.fn(), vi.fn(), { id: "n" }, undefined, "card");
  return { ledger, review, event };
}
describe("Decisions ledger entry", () => {
  it("opens a decisions document before the review path", () => { const { ledger, review, event } = opening(item); expect(ledger).toHaveBeenCalledWith("n"); expect(review).not.toHaveBeenCalled(); expect(event).toHaveBeenCalledWith("o", "card"); });
  it("keeps plain documents on the review path", () => { const { ledger, review } = opening({ ...item, doc_kind: null }); expect(ledger).not.toHaveBeenCalled(); expect(review).toHaveBeenCalledWith("n"); });
  it("shows Open ledger first and never Preview for a Decisions card", () => {
    const open = vi.fn();
    render(<LabCardMenu selected={false} canBranch={false} local={false} open onOpenChange={() => undefined} cardRef={{ current: null }} onSelect={() => undefined} onOpen={() => undefined} onOpenLedger={open} onBranch={() => undefined} onHide={() => undefined} onDelete={() => undefined} />);
    expect(screen.getAllByRole("menuitem")[0]?.textContent).toBe("Open ledger"); expect(screen.queryByText("Preview")).toBeNull(); fireEvent.click(screen.getByText("Open ledger")); expect(open).toHaveBeenCalledOnce();
  });
  it("Escape closes the overlay", () => {
    const close = vi.fn(); render(<QueryClientProvider client={new QueryClient()}><DecisionsLedger nodeId="n" item={item} onClose={close} /></QueryClientProvider>);
    fireEvent.keyDown(window, { key: "Escape" }); expect(close).toHaveBeenCalledOnce();
  });
  it("renders current lines, reasons, pointers and dropped lines last", async () => {
    h.lines = [{ id: "a", document_id: "d", ord: 1, call_text: "Dropped", why: "", status: "discarded", srcs: [] }, { id: "b", document_id: "d", ord: 2, call_text: "Live", why: "Reason", status: "confirmed", srcs: [{ turn: 4 }] }];
    render(<QueryClientProvider client={new QueryClient()}><DecisionsLedger nodeId="n" item={item} onClose={() => undefined} /></QueryClientProvider>);
    expect(screen.getAllByRole("listitem").map((node) => node.textContent)).toEqual(["AgreedLiveReasonturn 4", "DroppedDropped"]);
    expect(await screen.findByText(/Version 3/)).toBeTruthy();
  });
  it.each(["card", "menu", "key"] as const)("records content-free %s entry", (via) => { noteWorkboardLedgerOpened("o", via); expect(logEvent).toHaveBeenCalledWith("workboard.ledger_opened", "o", { via }); });
});
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DecisionLine } from "@/hooks/use-decision-lines";
import type { WorkItemRow } from "@/lib/work-types";
import { renderDecisionsMarkdown } from "@/lib/mcp-decisions";
const h = vi.hoisted(() => ({ url: vi.fn(), event: vi.fn(), clipboard: vi.fn() }));
vi.mock("@/lib/decisions.functions", () => ({ updateDecisionLine: vi.fn(), addDecisionLine: vi.fn(), recordDecisionsVersion: vi.fn(), removeDecisionLine: vi.fn(), restoreDecisionLine: vi.fn(), reorderDecisionLines: vi.fn(), setDecisionPointer: vi.fn() }));
vi.mock("@/lib/work-files.functions", () => ({ getVersionFileUrl: h.url }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("../canvas-lab-telemetry", () => ({ noteWorkboardLedgerOpened: h.event }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: table === "profiles" ? { org_id: "org" } : { parent_work_item_id: "chat" }, error: null }), order: async () => ({ data: [], error: null }) }) }) }) } }));
import { DecisionsLedger } from "../DecisionsLedger";
let client: QueryClient;
const versions = [{ id: "v3", version_no: 3, created_at: "2026-10-26T12:00:00Z", source_event: "ledger_edit" }, { id: "v2", version_no: 2, created_at: "2026-10-25T12:00:00Z", source_event: "mcp_repush" }, { id: "v1", version_no: 1, created_at: "2026-10-24T12:00:00Z", source_event: "mcp_push" }];
const line = (id: string, ord: number, status: DecisionLine["status"] = "draft", why = ""): DecisionLine => ({ id, document_id: "doc", ord, call_text: id, status, why, srcs: [] });
const initial = [line("Same", 1), line("Moved", 2), line("Changed", 3), line("Removed", 4)];
const changed = [line("Same", 1), line("Changed", 2, "confirmed"), line("Moved", 3), line("Added", 4)];
const live = [{ ...line("Live statement", 1, "confirmed", "A reason"), srcs: [{ turn: 42 }] }, line("Dropped statement", 2, "discarded", "Set aside reason")];
function mount() {
  const item: WorkItemRow = { id: "doc", title: "Decision memo", type: "document", source: "mcp:push", captured_at: "2026-10-26", visibility: "unmapped", content_ref: "d.md", work_item_tasks: [] };
  render(<QueryClientProvider client={client}><DecisionsLedger item={item} nodeId="n" canEdit profileId="profile" onClose={vi.fn()} /></QueryClientProvider>);
}
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["decision-lines", "doc"], live); client.setQueryData(["document-versions", "doc"], versions);
  h.url.mockImplementation(async ({ data }) => ({ url: `https://files.example/${data.version_id}` }));
  vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, text: async () => renderDecisionsMarkdown("Decision memo", url.endsWith("v3") ? changed.map((l) => ({ ...l, ord: l.ord ?? 0, why: l.why ?? "" })) : initial.map((l) => ({ ...l, ord: l.ord ?? 0, why: l.why ?? "" }))) })));
  h.clipboard.mockResolvedValue(undefined); Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: h.clipboard } });
});
afterEach(() => { cleanup(); client.clear(); vi.clearAllMocks(); vi.unstubAllGlobals(); });
describe("versions and memo", () => {
  it("lists all three source labels newest first and compares newest by default", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Versions" }));
    const panel = screen.getByRole("complementary", { name: "Versions" });
    expect(within(panel).getByText("Edited in Lasso")).toBeTruthy(); expect(within(panel).getByText("Pushed again from a chat")).toBeTruthy(); expect(within(panel).getByText("Pushed from a chat")).toBeTruthy();
    expect(await within(panel).findByText("added")).toBeTruthy(); expect(within(panel).getByText("changed")).toBeTruthy(); expect(within(panel).getByText("moved")).toBeTruthy(); expect(within(panel).getByText("removed")).toBeTruthy(); expect(within(panel).getByText("Removed")).toBeTruthy();
    expect(h.url).toHaveBeenCalledWith({ data: { version_id: "v2" } });
  });
  it("selecting a different version reads it and its predecessor", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Versions" }));
    await screen.findByText("changed"); fireEvent.click(screen.getByRole("button", { name: /Version 2.*Pushed again/ }));
    await waitFor(() => expect(h.url).toHaveBeenCalledWith({ data: { version_id: "v1" } }));
    await waitFor(() => expect(screen.queryByText("changed")).toBeNull());
  });
  it("unreadable files show only the entry error, not lines", async () => {
    h.url.mockRejectedValue(new Error("unavailable")); mount(); fireEvent.click(screen.getByRole("button", { name: "Versions" }));
    await screen.findByText("This version could not be opened."); expect(screen.queryByText("1. Same")).toBeNull(); expect(screen.queryByText("added")).toBeNull();
  });
  it("Memo uses live lines, dates and pointer marks without edit controls", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Memo" }));
    const memo = document.querySelector(".lasso-decisions-memo"); if (!(memo instanceof HTMLElement)) throw new Error("Missing memo");
    expect(within(memo).getByRole("heading", { name: "Decision memo" })).toBeTruthy(); expect(within(memo).getByText("Updated Oct 26, 2026")).toBeTruthy();
    expect(within(memo).getByText("Set aside")).toBeTruthy(); expect(within(memo).getByText("Live statement").closest("li")?.parentElement?.tagName).toBe("OL");
    expect(within(memo).getByText("from a chat on this board")).toBeTruthy(); expect(memo.textContent).not.toContain("42"); expect(memo.textContent).not.toMatch(/author|approved by/i);
    expect(screen.queryByRole("textbox")).toBeNull(); expect(screen.queryByRole("button", { name: "Line actions" })).toBeNull(); expect(screen.queryByRole("button", { name: "Add a decision" })).toBeNull();
    await waitFor(() => expect(h.event).toHaveBeenCalledWith("org", "memo_preview"));
  });
  it("Copy writes the full plain text and confirms", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Memo" })); fireEvent.click(screen.getByRole("button", { name: "Copy as text" }));
    await screen.findByRole("button", { name: "Copied" });
    expect(h.clipboard).toHaveBeenCalledWith("Decision memo\n\nUpdated Oct 26, 2026\n\n1. Live statement\n   Agreed\n   A reason\n   from a chat on this board\n\nSet aside\n\n1. Dropped statement\n   Dropped\n   Set aside reason");
  });
});
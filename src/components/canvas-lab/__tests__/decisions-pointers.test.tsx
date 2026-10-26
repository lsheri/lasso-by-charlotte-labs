// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkItemRow } from "@/lib/work-types";
const h = vi.hoisted(() => ({ pointer: vi.fn(), parent: "chat" as string | null }));
vi.mock("@/lib/decisions.functions", () => ({ updateDecisionLine: vi.fn(), addDecisionLine: vi.fn(), recordDecisionsVersion: vi.fn(), setDecisionPointer: h.pointer }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/work-files.functions", () => ({ getVersionFileUrl: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { parent_work_item_id: h.parent }, error: null }), order: async () => ({ data: [], error: null }) }) }) }) } }));
import { DecisionsLedger } from "../DecisionsLedger";
let client: QueryClient;
let sequence = 0;
let id: string;
function mount(canEdit = true, turn: number | null = null) {
  const follow = vi.fn();
  const item: WorkItemRow = { id, title: "Decisions", type: "document", doc_kind: "decisions", source: "mcp:push", captured_at: "2026-10-26", content_ref: "d.md", visibility: "unmapped", work_item_tasks: [] };
  client.setQueryData(["decision-lines", id], [{ id: "line", document_id: id, ord: 1, call_text: "Decision", why: "", status: "draft", srcs: turn === null ? [] : [{ turn }] }]);
  render(<QueryClientProvider client={client}><DecisionsLedger item={item} nodeId="n" canEdit={canEdit} onClose={vi.fn()} onFollowPointer={follow} /></QueryClientProvider>);
  return follow;
}
async function openMenu() { await waitFor(() => expect(client.getQueryData(["decision-parent", id])).toBe(h.parent)); fireEvent.click(screen.getByRole("button", { name: "Line actions" })); }
beforeEach(() => {
  id = `pointer-${++sequence}`; h.parent = "chat";
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["turns", "chat"], [{ id: "t1", turn_no: 1, role: "user", content: "Question about options", ts: null }, { id: "t2", turn_no: 2, role: "assistant", content: "Choose the second option", ts: null }]);
  h.pointer.mockImplementation(async ({ data }) => ({ id: "line", srcs: data.turn === null ? [] : [{ turn: data.turn }] }));
});
afterEach(() => { cleanup(); client.clear(); vi.clearAllMocks(); });
describe("decision pointers", () => {
  it("lists source turns using You and AI, and search filters their text", async () => {
    mount(); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Point to a chat turn" }));
    expect(await screen.findByText("turn 1 · You")).toBeTruthy(); expect(screen.getByText("turn 2 · AI")).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Search this chat" }), { target: { value: "second" } });
    expect(screen.queryByText("Question about options")).toBeNull(); expect(screen.getByText("Choose the second option")).toBeTruthy();
  });
  it("selecting a turn sets its pointer and closes the picker", async () => {
    mount(); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Point to a chat turn" }));
    fireEvent.click(await screen.findByRole("button", { name: /turn 2 · AI/ }));
    await waitFor(() => expect(h.pointer).toHaveBeenCalledWith({ data: { document_id: id, id: "line", turn: 2 } }));
    expect(screen.queryByRole("textbox")).toBeNull(); expect(screen.getByRole("button", { name: "turn 2" })).toBeTruthy();
  });
  it("Clear pointer sends turn null", async () => {
    mount(true, 2); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Clear pointer" }));
    await waitFor(() => expect(h.pointer).toHaveBeenCalledWith({ data: { document_id: id, id: "line", turn: null } }));
    expect(screen.queryByRole("button", { name: "turn 2" })).toBeNull();
  });
  it("the mark follows the parent chat and exact turn", async () => {
    const follow = mount(true, 2); await waitFor(() => expect((screen.getByRole("button", { name: "turn 2" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "turn 2" })); expect(follow).toHaveBeenCalledWith("chat", 2);
  });
  it("no parent disables pointing with the specified title", async () => {
    h.parent = null; mount(); await openMenu(); const point = screen.getByRole("menuitem", { name: "Point to a chat turn" });
    expect((point as HTMLButtonElement).disabled).toBe(true); expect(point.title).toBe("This document did not come from a chat");
  });
  it("readers can follow a mark but have no row menu", async () => {
    const follow = mount(false, 2); await waitFor(() => expect((screen.getByRole("button", { name: "turn 2" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "turn 2" })); expect(follow).toHaveBeenCalledWith("chat", 2);
    expect(screen.queryByRole("button", { name: "Line actions" })).toBeNull(); expect(screen.queryByRole("menuitem")).toBeNull();
  });
  it("a failed pointer rolls back and shows the row error", async () => {
    h.pointer.mockRejectedValueOnce(new Error("no")); mount(true, 1); await openMenu(); fireEvent.click(screen.getByRole("menuitem", { name: "Clear pointer" }));
    await screen.findByText("Could not save. Try again."); expect(screen.getByRole("button", { name: "turn 1" })).toBeTruthy();
  });
});
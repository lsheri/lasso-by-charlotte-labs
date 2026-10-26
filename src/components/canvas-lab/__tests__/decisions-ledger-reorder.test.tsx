// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkItemRow } from "@/lib/work-types";
import type { DecisionLine } from "@/hooks/use-decision-lines";
import type { Database } from "@/integrations/supabase/types";
const h = vi.hoisted(() => ({ update: vi.fn(), add: vi.fn(), version: vi.fn(), versions: vi.fn(), remove: vi.fn(), restore: vi.fn(), reorder: vi.fn() }));
vi.mock("@/lib/decisions.functions", () => ({ updateDecisionLine: h.update, addDecisionLine: h.add, recordDecisionsVersion: h.version, removeDecisionLine: h.remove, restoreDecisionLine: h.restore, reorderDecisionLines: h.reorder }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: h.versions }) }) }) } }));
import { DecisionsLedger } from "../DecisionsLedger";
import { emptyUndoStacks, expireLedgerRemoval, popUndo, recordUndo, type LedgerRemoveEntry } from "../canvas-lab-undo";
let sequence = 0;
let documentId: string;
let client: QueryClient;
let originals: DecisionLine[];
function line(id: string, ord: number, status: DecisionLine["status"] = "draft"): DecisionLine { return { id, document_id: documentId, ord, call_text: `Decision ${id}`, why: "", status, srcs: [] }; }
function fullRow(): Database["public"]["Tables"]["decisions"]["Row"] { return { ...line("a", 1), created_at: "2026-10-26", created_by: "p", decided_at: null, engagement_id: null, kind: "call", evidence_turn_ids: [], source_item_id: null, source_turn_id: null, statement: "Decision a", supersedes_id: null, updated_at: "2026-10-26" } as Database["public"]["Tables"]["decisions"]["Row"]; }
function mount(canEdit = true) {
  const onUndoableRemove = vi.fn();
  const item: WorkItemRow = { id: documentId, title: "Decisions", type: "document", doc_kind: "decisions", source: "mcp:push", captured_at: "2026-10-26", content_ref: "d.md", visibility: "unmapped", work_item_tasks: [] };
  render(<QueryClientProvider client={client}><DecisionsLedger item={item} nodeId="n" canEdit={canEdit} onClose={vi.fn()} onUndoableRemove={onUndoableRemove} /></QueryClientProvider>);
  return onUndoableRemove;
}
function row(id: string) { const element = screen.getByRole("button", { name: `Decision ${id}` }).closest("li"); if (!element) throw new Error("Missing row"); return element; }
function order() { return client.getQueryData<DecisionLine[]>(["decision-lines", documentId])?.map((entry) => entry.id); }
function menu(id: string, name: string) { fireEvent.click(within(row(id)).getByRole("button", { name: "Line actions" })); fireEvent.click(screen.getByRole("menuitem", { name })); }
beforeEach(() => {
  documentId = `reorder-${++sequence}`;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  originals = [line("a", 1), line("b", 2), line("c", 3, "discarded"), line("d", 4, "discarded")];
  client.setQueryData(["decision-lines", documentId], originals);
  h.versions.mockResolvedValue({ data: [], error: null }); h.version.mockResolvedValue({});
  h.remove.mockResolvedValue(fullRow());
  h.reorder.mockImplementation(async ({ data }) => data.ids_in_order.map((id: string, ord: number) => ({ ...originals.find((entry) => entry.id === id), ord: ord + 1 })));
});
afterEach(() => { cleanup(); client.clear(); vi.clearAllMocks(); });
describe("Ledger removal and ordering", () => {
  it("Move down swaps live rows and sends the full order", async () => {
    mount(); menu("a", "Move down");
    await waitFor(() => expect(order()).toEqual(["b", "a", "c", "d"]));
    expect(h.reorder).toHaveBeenCalledWith({ data: { document_id: documentId, ids_in_order: ["b", "a", "c", "d"] } });
  });
  it("Alt ArrowUp moves a focused row", async () => {
    mount(); row("b").focus(); fireEvent.keyDown(row("b"), { key: "ArrowUp", altKey: true });
    await waitFor(() => expect(h.reorder).toHaveBeenCalledWith({ data: { document_id: documentId, ids_in_order: ["b", "a", "c", "d"] } }));
  });
  it("live rows stop above dropped rows, which move only within their group", async () => {
    mount(); row("b").focus(); fireEvent.keyDown(row("b"), { key: "ArrowDown", altKey: true });
    expect(h.reorder).not.toHaveBeenCalled();
    fireEvent.click(within(row("b")).getByRole("button", { name: "Line actions" }));
    expect((screen.getByRole("menuitem", { name: "Move down" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.keyDown(screen.getByRole("menuitem", { name: "Move up" }), { key: "Escape" });
    menu("c", "Move down"); await waitFor(() => expect(order()).toEqual(["a", "b", "d", "c"]));
  });
  it("removes immediately and returns the exact deleted row and previous order", async () => {
    let resolve: (value: ReturnType<typeof fullRow>) => void = () => undefined;
    h.remove.mockReturnValueOnce(new Promise((done) => { resolve = done; }));
    const undo = mount(); menu("a", "Remove");
    await waitFor(() => expect(screen.queryByRole("button", { name: "Decision a" })).toBeNull());
    expect(h.remove).toHaveBeenCalledWith({ data: { document_id: documentId, id: "a" } }); expect(undo).not.toHaveBeenCalled();
    const deleted = fullRow(); await act(async () => resolve(deleted));
    expect(undo).toHaveBeenCalledWith({ documentId, row: deleted, ids_in_order: ["a", "b", "c", "d"] });
  });
  it("a rejected remove restores the row and shows its error", async () => {
    h.remove.mockRejectedValueOnce(new Error("no")); mount(); menu("a", "Remove");
    await screen.findByText("Could not save. Try again."); expect(row("a")).toBeTruthy(); expect(order()).toEqual(["a", "b", "c", "d"]);
  });
  it("Delete on a row removes, but Delete in the editor does not", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Decision b" }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Delete" }); expect(h.remove).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" }); row("a").focus(); fireEvent.keyDown(row("a"), { key: "Delete" });
    await waitFor(() => expect(h.remove).toHaveBeenCalledWith({ data: { document_id: documentId, id: "a" } }));
  });
  it("readers have no handles or menus and Delete does nothing", () => {
    mount(false); const first = screen.getAllByRole("listitem")[0]; if (!first) throw new Error("Missing row");
    first.focus(); fireEvent.keyDown(first, { key: "Delete" });
    expect(screen.queryByRole("button", { name: "Drag to reorder" })).toBeNull(); expect(screen.queryByRole("button", { name: "Line actions" })).toBeNull(); expect(h.remove).not.toHaveBeenCalled();
  });
  it("reorder rejection restores the full original order", async () => {
    h.reorder.mockRejectedValueOnce(new Error("no")); mount(); menu("a", "Move down");
    await screen.findByText("Could not save. Try again."); expect(order()).toEqual(["a", "b", "c", "d"]);
  });
  it("expiry removes only the named Ledger entry, leaving ordinary undo intact", () => {
    const entry: LedgerRemoveEntry = { documentId, row: fullRow(), ids_in_order: ["a", "b", "c", "d"] };
    let stacks = recordUndo(emptyUndoStacks(), { id: "move", action: "move", nodeId: "n", before: { x: 0, y: 0 }, after: { x: 1, y: 1 } });
    stacks = recordUndo(stacks, { id: "removed", action: "ledger_remove_line", ...entry });
    expect(popUndo(expireLedgerRemoval(stacks, "removed")).entry?.id).toBe("move");
    expect(expireLedgerRemoval(stacks, "move").undo).toHaveLength(2);
    expect(expireLedgerRemoval(popUndo(stacks).stacks, "removed").redo).toHaveLength(0);
  });
});
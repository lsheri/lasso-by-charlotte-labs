// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WorkItemRow } from "@/lib/work-types";
import type { DecisionLine } from "@/hooks/use-decision-lines";
const h = vi.hoisted(() => ({ update: vi.fn(), add: vi.fn(), version: vi.fn(), versions: vi.fn() }));
vi.mock("@/lib/decisions.functions", () => ({ updateDecisionLine: h.update, addDecisionLine: h.add, recordDecisionsVersion: h.version, removeDecisionLine: vi.fn(), restoreDecisionLine: vi.fn(), reorderDecisionLines: vi.fn() }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({ select: () => ({ eq: () => ({ order: h.versions }) }) }) } }));
import { DecisionsLedger, COPY } from "../DecisionsLedger";
import { COPY as LINE_COPY } from "../DecisionsLine";
function at<T>(values: T[], index: number): T { const value = values[index]; if (value === undefined) throw new Error("Missing test element"); return value; }
function first<T>(values: T[]): T { return at(values, 0); }
let sequence = 0;
let documentId = "";
let client: QueryClient;
const line = (id = "a", ord = 1): DecisionLine => ({ id, document_id: documentId, ord, call_text: id === "a" ? "First decision" : "Second decision", why: "", status: "draft", srcs: [] });
function mount(canEdit = true, onClose = vi.fn()) {
  const item: WorkItemRow = { id: documentId, title: "Decisions", type: "document", doc_kind: "decisions", source: "mcp:push", captured_at: "2026-10-26", content_ref: "d.md", visibility: "unmapped", work_item_tasks: [] };
  const view = render(<QueryClientProvider client={client}><DecisionsLedger item={item} nodeId="n" canEdit={canEdit} onClose={onClose} /></QueryClientProvider>);
  return { ...view, onClose };
}
beforeEach(() => {
  documentId = `edit-${++sequence}`;
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } } });
  client.setQueryData(["decision-lines", documentId], [line(), line("b", 2)]);
  h.versions.mockResolvedValue({ data: [{ id: "v", version_no: 1, created_at: "2026-10-26" }], error: null });
  h.update.mockImplementation(async ({ data }) => ({ ...line(data.id), ...data.patch }));
  h.add.mockImplementation(async ({ data }) => ({ ...line("new", 3), ...data, why: "", status: "draft" }));
  h.version.mockResolvedValue({ version_no: 2 });
});
afterEach(() => { cleanup(); client.clear(); vi.clearAllMocks(); });
async function chooseAgreed() {
  fireEvent.click(first(screen.getAllByRole("button", { name: "Open" })));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "Agreed" }));
}
describe("owner Ledger editing", () => {
  it("optimistically changes the pill before the confirmed request resolves", async () => {
    let resolve: (row: DecisionLine) => void = () => undefined;
    h.update.mockReturnValueOnce(new Promise<DecisionLine>((done) => { resolve = done; }));
    mount(); await chooseAgreed();
    await waitFor(() => expect(screen.getByRole("button", { name: "Agreed" })).toBeTruthy());
    expect(h.update).toHaveBeenCalledWith({ data: { document_id: documentId, id: "a", patch: { status: "confirmed" } } });
    expect(screen.getByText("Saving")).toBeTruthy();
    await act(async () => resolve({ ...line(), status: "confirmed" }));
    expect(await screen.findByText("Saved")).toBeTruthy();
  });
  it("rolls back a rejected status save and shows the row error", async () => {
    h.update.mockRejectedValueOnce(new Error("no")); mount(); await chooseAgreed();
    expect(await screen.findByText("Could not save. Try again.")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Open" })).toHaveLength(2);
    expect(client.getQueryData<DecisionLine[]>(["decision-lines", documentId])?.[0]?.status).toBe("draft");
  });
  it("Enter saves only trimmed statement text and Escape restores it", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "First decision" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Decision" }), { target: { value: "  New decision  " } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ data: { document_id: documentId, id: "a", patch: { call_text: "New decision" } } }));
    fireEvent.click(await screen.findByRole("button", { name: "New decision" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Cancel me" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.getByRole("button", { name: "New decision" })).toBeTruthy(); expect(h.update).toHaveBeenCalledTimes(1);
  });
  it("identical trimmed text makes no server call", () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "First decision" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: " First decision " } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(h.update).not.toHaveBeenCalled();
  });
  it("adds an Open row on Enter and focuses the empty editor", async () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "Add a decision" }));
    const editor = screen.getByRole("textbox", { name: "Decision" }); expect(document.activeElement).toBe(editor);
    fireEvent.change(editor, { target: { value: "Added decision" } }); fireEvent.keyDown(editor, { key: "Enter" });
    await waitFor(() => expect(h.add).toHaveBeenCalledWith({ data: { document_id: documentId, call_text: "Added decision", status: "draft" } }));
    expect(await screen.findByRole("button", { name: "Added decision" })).toBeTruthy();
    expect(screen.getAllByRole("listitem").at(-1)?.textContent).toContain("Added decision");
  });
  it("records a dirty version before closing, but closes a clean Ledger immediately", async () => {
    const close = vi.fn(); const view = mount(true, close);
    fireEvent.click(screen.getByRole("button", { name: "Back to the workboard" })); expect(close).toHaveBeenCalledOnce(); expect(h.version).not.toHaveBeenCalled();
    close.mockClear(); await chooseAgreed(); await screen.findByText("Saved");
    let resolve: () => void = () => undefined;
    h.version.mockReturnValueOnce(new Promise<void>((done) => { resolve = done; }));
    fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(h.version).toHaveBeenCalledWith({ data: { document_id: documentId } }));
    expect(close).not.toHaveBeenCalled();
    await act(async () => resolve()); await waitFor(() => expect(close).toHaveBeenCalledOnce()); view.unmount();
  });
  it("retains dirty state after failed close and retries on reopening", async () => {
    const view = mount(); await chooseAgreed(); await screen.findByText("Saved"); h.version.mockRejectedValueOnce(new Error("no"));
    fireEvent.click(screen.getByRole("button", { name: "Back to the workboard" })); await waitFor(() => expect(view.onClose).toHaveBeenCalledOnce());
    view.unmount(); const second = mount(); fireEvent.keyDown(window, { key: "Escape" });
    await waitFor(() => expect(second.onClose).toHaveBeenCalledOnce()); expect(h.version).toHaveBeenCalledTimes(2);
  });
  it("Save a version refreshes versions and clears dirty", async () => {
    mount(); const save = screen.getByRole("button", { name: "Save a version" }); expect((save as HTMLButtonElement).disabled).toBe(true);
    await chooseAgreed(); await screen.findByText("Saved");
    h.versions.mockResolvedValue({ data: [{ id: "v2", version_no: 2, created_at: "2026-10-26" }], error: null });
    fireEvent.click(save); await screen.findByText(/Version 2/); expect((save as HTMLButtonElement).disabled).toBe(true);
  });
  it("a reader has no editing controls and Enter or S cannot edit", () => {
    mount(false); const row = first(screen.getAllByRole("listitem")); row.focus();
    fireEvent.keyDown(row, { key: "s" }); fireEvent.keyDown(row, { key: "Enter" });
    expect(screen.queryByRole("menu")).toBeNull(); expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Add a decision" })).toBeNull(); expect(screen.queryByRole("button", { name: "Save a version" })).toBeNull(); expect(h.update).not.toHaveBeenCalled();
  });
  it("arrow keys move row focus; S opens the current-marked menu", () => {
    mount(); const rows = screen.getAllByRole("listitem"); first(rows).focus(); fireEvent.keyDown(first(rows), { key: "ArrowDown" }); expect(document.activeElement).toBe(at(rows, 1));
    fireEvent.keyDown(at(rows, 1), { key: "ArrowUp" }); expect(document.activeElement).toBe(first(rows));
    fireEvent.keyDown(first(rows), { key: "s" }); const current = screen.getByRole("menuitemradio", { name: /Open/ }); expect(current.getAttribute("aria-checked")).toBe("true");
    fireEvent.keyDown(current, { key: "ArrowDown" }); expect(document.activeElement).toBe(screen.getByRole("menuitemradio", { name: "Agreed" }));
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" }); expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.keyDown(first(rows), { key: "Enter" }); expect(screen.getByRole("textbox")).toBeTruthy();
  });
  it("reason blur saves trimmed text; Shift+Enter does not save", async () => {
    mount(); fireEvent.click(first(screen.getAllByRole("button", { name: "Add a reason" })));
    const editor = screen.getByRole("textbox", { name: "Reason" }); fireEvent.change(editor, { target: { value: "  First\nSecond  " } });
    fireEvent.keyDown(editor, { key: "Enter", shiftKey: true }); expect(h.update).not.toHaveBeenCalled(); fireEvent.blur(editor);
    await waitFor(() => expect(h.update).toHaveBeenCalledWith({ data: { document_id: documentId, id: "a", patch: { why: "First\nSecond" } } }));
  });
  it("limits statement to 400 and reason to 1000 with a counter after 350", () => {
    mount(); fireEvent.click(screen.getByRole("button", { name: "First decision" })); expect(screen.getByRole("textbox").getAttribute("maxlength")).toBe("400");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "x".repeat(351) } }); expect(screen.getByText("351/400")).toBeTruthy(); fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    fireEvent.click(first(screen.getAllByRole("button", { name: "Add a reason" }))); expect(screen.getByRole("textbox").getAttribute("maxlength")).toBe("1000");
  });
  it("Dropping a row moves it below live rows", async () => {
    mount(); fireEvent.click(first(screen.getAllByRole("button", { name: "Open" }))); fireEvent.click(screen.getByRole("menuitemradio", { name: "Dropped" }));
    await waitFor(() => expect(within(at(screen.getAllByRole("listitem"), 1)).getByRole("button", { name: "First decision" })).toBeTruthy());
  });
  it("pins copy values without banned language or em dashes", () => {
    expect(COPY.add).toBe("Add a decision"); expect(COPY.saveVersion).toBe("Save a version"); expect(LINE_COPY.error).toBe("Could not save. Try again.");
    const strings = [...Object.values(COPY), ...Object.values(LINE_COPY)].filter((value): value is string => typeof value === "string");
    for (const value of strings) { expect(value).not.toMatch(/—|\b(?:score\w*|monitor\w*|track\w*|surveillance|oversight|governance|compliance|integrity|fluency|gaps|caught|author)\b/i); }
  });
});
// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PeekActionBar } from "@/components/peek/PeekActionBar";
import { RenameWorkDialog, RENAME_COPY } from "@/components/work/RenameWorkDialog";
import { ownsWorkItem } from "@/lib/work-ownership";
import type { WorkItemRow } from "@/lib/work-types";
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1", role: "consultant" } }) }));
vi.mock("@/components/decisions/DraftDecisionsButton", () => ({ useDraftDecisions: () => ({ busy: false, draft: vi.fn() }) }));
vi.mock("@/components/peek/PortfolioMenuItem", () => ({ PortfolioMenuItem: () => null }));
vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div role="menu">{children}</div>,
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children, onSelect, disabled }: { children: React.ReactNode; onSelect?: () => void; disabled?: boolean }) => <button role="menuitem" disabled={disabled} onClick={onSelect}>{children}</button>,
}));
afterEach(cleanup);
const item = { id: "w1", title: "Original", owner_id: "p1", type: "ai_thread", visibility: "unmapped", meta: {} } as WorkItemRow;
function menu(ownerId: string, onRename = vi.fn()) {
  render(<PeekActionBar item={item} canEdit owned={ownsWorkItem({ id: ownerId, role: "consultant" }, item)} onRename={onRename} onWorkDate={vi.fn()} onMakePrivate={vi.fn()} onShip={vi.fn()} onBrief={vi.fn()} onRemove={vi.fn()} onDelete={vi.fn()} />);
  return onRename;
}
describe("WI-1e All work reader rename", () => {
  it("opens the existing dialog and can cancel without a write", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return <><PeekActionBar item={item} canEdit owned onRename={() => setOpen(true)} onShip={vi.fn()} onBrief={vi.fn()} onRemove={vi.fn()} onDelete={vi.fn()} /><RenameWorkDialog item={item} open={open} onOpenChange={setOpen} /></>;
    }
    render(<QueryClientProvider client={new QueryClient()}><Harness /></QueryClientProvider>);
    fireEvent.click(screen.getByRole("menuitem", { name: RENAME_COPY.menu }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: RENAME_COPY.label }).getAttribute("value")).toBe("Original");
    expect(screen.getByText(RENAME_COPY.helper)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: RENAME_COPY.cancel }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("adds only rename next to Work date and opens the callback", () => {
    const rename = menu("p1");
    expect(screen.getAllByRole("menuitem").map((node) => node.textContent)).toEqual(["Work date", "Rename for others", "Find decisions in this conversation", "Make private", "Delete this work"]);
    fireEvent.click(screen.getByRole("menuitem", { name: RENAME_COPY.menu }));
    expect(rename).toHaveBeenCalledWith(item);
  });
  it("never offers rename for another person's work", () => {
    menu("p2");
    expect(screen.queryByRole("menuitem", { name: RENAME_COPY.menu })).toBeNull();
  });
  it("leaves other reader surfaces unchanged without opt-in", () => {
    render(<PeekActionBar item={item} canEdit owned onShip={vi.fn()} onBrief={vi.fn()} onRemove={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.queryByText(RENAME_COPY.menu)).toBeNull();
  });
  it("pins the owner gate and existing dialog on All work", () => {
    const page = readFileSync("src/pages/WorkPage.tsx", "utf8");
    expect(readFileSync("src/components/peek/PeekPanel.tsx", "utf8")).toContain("onRename={ownsWorkItem(profile, active) ? onRename : undefined}");
    expect(page).toContain("if (!ownsWorkItem(profile, item)) return;");
    expect(page).toContain("setRenameItem(item);");
    expect(page).toContain("<RenameWorkDialog");
    expect(page).toContain("item={renameItem}");
  });
  it("pins copy and existing cache refresh", () => {
    expect(RENAME_COPY.menu).toBe("Rename for others");
    expect(RENAME_COPY.helper).toBe("This is the name other people see. The original is kept.");
    expect(Object.values(RENAME_COPY).join(" ")).not.toMatch(/—|\b(?:score|monitor|track|surveillance|oversight|governance|compliance|integrity|fluency|gaps|caught)\b/i);
    expect(readFileSync("src/components/work/RenameWorkDialog.tsx", "utf8")).toContain("void queryClient.invalidateQueries()");
  });
});

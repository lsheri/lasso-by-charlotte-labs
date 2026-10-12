// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardMenu } from "@/components/work/CardMenu";
import { LabCard } from "@/components/canvas-lab/LabCard";
import { Button } from "@/components/ui/button";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";
import type { WorkItemRow } from "@/lib/work-types";

vi.mock("@/components/work/RowMenu", () => ({
  useRowMenuParts: () => ({ items: <DropdownMenuItem>Shared action</DropdownMenuItem>, dialogs: null }),
}));
afterEach(cleanup);
const read = (path: string) => readFileSync(path, "utf8");
const item = { id: "w1", title: "Memo", source: "import:manual", captured_at: "2026-10-12T00:00:00Z", work_item_tasks: [], meta: {} } as WorkItemRow;

describe("UX-P1 review fixes", () => {
  it.each(["Put on a board", "Work date", "Shared action"])("CS-4 closes the menu when %s is selected", async (label) => {
    const selected = vi.fn();
    function Card() {
      const [dialog, setDialog] = useState(false);
      return <>
        <CardMenu item={item}>
          <Button onClick={() => { selected(); setDialog(true); }}>Put on a board</Button>
          <Button onClick={selected}>Work date</Button>
        </CardMenu>
        {dialog ? <div role="dialog">Choose board<Button onClick={() => setDialog(false)}>Done</Button></div> : null}
      </>;
    }
    render(<Card />);
    fireEvent.keyDown(screen.getByTestId("card-menu-trigger"), { key: "Enter" });
    expect(await screen.findByRole("menu")).toBeTruthy();
    fireEvent.click(screen.getByRole(label === "Shared action" ? "menuitem" : "button", { name: label }));
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    if (label !== "Shared action") expect(selected).toHaveBeenCalledTimes(1);
    if (label === "Put on a board") {
      expect(screen.getByRole("dialog")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Done" }));
      expect(screen.queryByRole("menu")).toBeNull();
    }
  });

  it("CS-6 uses Look back in the document title and Home link without changing its event", () => {
    const route = read("src/routes/_authenticated/archive.tsx");
    expect(route).toContain('{ title: "Look back | Lasso" }');
    expect(route).toContain('{ property: "og:title", content: "Look back | Lasso" }');
    const home = read("src/components/home/HomeBoard.tsx");
    expect(home).toContain('<Link to="/archive">Look back</Link>');
    expect(home).toContain('emitClientEvent("home.past_work_opened", {})');
  });

  it("CS-12 removes the toolbar control while an existing judgment node still renders", () => {
    const page = read("src/pages/CanvasLabPage.tsx");
    const toolbar = page.slice(page.indexOf("const toolbarItems"), page.indexOf("const toolbarPlan"));
    expect(toolbar).not.toContain("Human judgment");
    expect(toolbar).not.toContain('id: "add-judgment"');
    const node = { id: "judgment:existing", kind: "judgment", title: "Existing judgment", summary: "Keep the original recommendation.", typeLabel: "Human judgment", ownership: "yours", local: false, frame: null, x: 0, y: 0, width: 320, height: 240 } as LabNode;
    const noop = () => {};
    render(<LabCard node={node} selected={false} focused={false} connecting={false} connectSourceAnchor={null} canResize={false} structured={false} frameChoices={[]} readOnly onSelect={noop} onOpen={noop} onBranch={noop} onHide={noop} onDelete={noop} onEdit={noop} onEditCommitted={noop} onAnchorPointerDown={noop} onAnchorActivate={noop} onMenuOpened={noop} onMenuOpenChange={noop} onMeasure={noop} onPointerDown={noop} onFocus={noop} onKeyDown={noop} onResizeStart={noop} onFit={noop} onResizeKeyDown={noop} onResizeKeyUp={noop} />);
    expect(screen.getByText("Existing judgment")).toBeTruthy();
    expect(screen.getByText("Human judgment")).toBeTruthy();
    expect(screen.getByText("Keep the original recommendation.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Human judgment" })).toBeNull();
  });
});
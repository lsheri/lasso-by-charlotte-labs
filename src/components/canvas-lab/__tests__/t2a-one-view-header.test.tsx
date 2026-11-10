// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const vendor = { visible: true };
vi.mock("@/hooks/use-vendor-display", () => ({ useVendorVisible: () => vendor.visible }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));

import { LiftedWork, LIFT_COPY } from "@/components/canvas-lab/LiftedWork";
import { LIFT_HEAD_COPY } from "@/components/canvas-lab/LiftedWorkHead";
import { LIFT_MENU_COPY } from "@/lib/lift-view";

afterEach(() => {
  cleanup();
  vendor.visible = true;
});

function view(props: Partial<Parameters<typeof LiftedWork>[0]> = {}) {
  const onClose = vi.fn();
  render(
    <LiftedWork title="CS program research" kind="chat" origin={null} onClose={onClose} {...props}>
      {() => <p data-testid="inside">x</p>}
    </LiftedWork>,
  );
  return { onClose };
}

describe("T2a the one header: a window into the tool the work lives in", () => {
  it("shows the tool's mark and name with the date, and opens the work in that tool", () => {
    view({ brand: "claude", dateLine: "Oct 14, 2026", openUrl: "https://claude.ai/chat/abc" });
    expect(screen.getByTestId("lift-brand")).toBeTruthy();
    expect(screen.getByTestId("lift-meta").textContent).toBe("Claude · Oct 14, 2026");
    const open = screen.getByTestId("lift-open") as HTMLAnchorElement;
    expect(open.textContent).toContain(LIFT_HEAD_COPY.openIn("Claude"));
    expect(open.getAttribute("href")).toBe("https://claude.ai/chat/abc");
    expect(open.getAttribute("target")).toBe("_blank");
    expect(open.getAttribute("rel")).toContain("noopener");
  });

  it("the panel's top edge takes the tool's colour", () => {
    view({ brand: "claude" });
    expect(screen.getByTestId("lift-panel").style.getPropertyValue("--lift-brand")).toMatch(/^#/);
  });

  it("only an https link is drawn", () => {
    view({ brand: "claude", openUrl: "javascript:alert(1)" });
    expect(screen.queryByTestId("lift-open")).toBeNull();
  });

  it("a vendor-neutral workspace sees the kind icon and Open the original, never the tool's name", () => {
    vendor.visible = false;
    view({ brand: "claude", dateLine: "Oct 14, 2026", openUrl: "https://claude.ai/chat/abc" });
    expect(screen.queryByTestId("lift-brand")).toBeNull();
    expect(screen.getByTestId("lift-kind")).toBeTruthy();
    expect(screen.getByTestId("lift-meta").textContent).toBe("Oct 14, 2026");
    expect(screen.getByTestId("lift-open").textContent).toContain(LIFT_HEAD_COPY.openOriginal);
    expect(document.body.textContent).not.toContain("Claude");
  });

  it("a piece with no known tool keeps the kind icon and no Open link", () => {
    view({ brand: "unknown" });
    expect(screen.getByTestId("lift-kind")).toBeTruthy();
    expect(screen.queryByTestId("lift-open")).toBeNull();
  });

  it("there is no Expand: Back to the board is the only way out of the view", () => {
    view({ brand: "claude" });
    expect(screen.queryByRole("button", { name: /full view|expand/i })).toBeNull();
    expect(screen.getByRole("button", { name: LIFT_COPY.compress })).toBeTruthy();
  });
});

describe("T2a the More menu", () => {
  it("is not drawn when there is nothing in it", () => {
    view();
    expect(screen.queryByRole("button", { name: LIFT_HEAD_COPY.more })).toBeNull();
  });
  it("opens, runs an entry and closes", () => {
    const onSelect = vi.fn();
    view({ menu: [{ label: LIFT_MENU_COPY.branch, onSelect }] });
    fireEvent.click(screen.getByRole("button", { name: LIFT_HEAD_COPY.more }));
    fireEvent.click(screen.getByRole("menuitem", { name: LIFT_MENU_COPY.branch }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("lift-menu")).toBeNull();
  });
  it("Esc closes the menu first, and only then the view", () => {
    const { onClose } = view({ menu: [{ label: LIFT_MENU_COPY.branch, onSelect: () => undefined }] });
    fireEvent.click(screen.getByRole("button", { name: LIFT_HEAD_COPY.more }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("lift-menu")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("a press inside the work closes the menu", () => {
    view({ menu: [{ label: LIFT_MENU_COPY.branch, onSelect: () => undefined }] });
    fireEvent.click(screen.getByRole("button", { name: LIFT_HEAD_COPY.more }));
    fireEvent.pointerDown(screen.getByTestId("inside"), { button: 0 });
    expect(screen.queryByTestId("lift-menu")).toBeNull();
  });
  it("pressing the Open link or the menu never starts a move", () => {
    view({ brand: "claude", openUrl: "https://claude.ai/chat/abc" });
    const panel = screen.getByTestId("lift-panel");
    const left = panel.style.left;
    const open = screen.getByTestId("lift-open");
    fireEvent.pointerDown(open, { button: 0, clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerMove(open, { clientX: 80, clientY: 10, pointerId: 1 });
    expect(panel.style.left).toBe(left);
  });
});

describe("T2a on the board (wiring pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const head = readFileSync("src/components/canvas-lab/LiftedWorkHead.tsx", "utf8");
  it("the card's Open button and menu lift the work too, behind the same flag", () => {
    expect(page).toContain("onOpen={(origin) => liftCard(node, cardItem, origin)} onLift={(origin) => liftCard(node, cardItem, origin)}");
  });
  it("the view is given no Expand", () => {
    const lifted = page.slice(page.indexOf("<LiftedWork key={liftedNode.id}"), page.indexOf("<LiftedWorkBody"));
    expect(lifted).not.toContain("onExpand");
    expect(lifted).toContain("brand={sourceBrandKey(liftedItem)}");
    expect(lifted).toContain("menu={liftMenu(liftedNode, liftedItem)}");
  });
  it("menu entries close the view before opening something of their own; the ledger is there for the decisions doc", () => {
    const fn = page.slice(page.indexOf("function liftMenu"), page.indexOf("function liftMenu") + 700);
    expect(fn).toContain('item.doc_kind === "decisions"');
    expect(fn).toContain("setLifted(null); openNode(node, undefined, \"menu\");");
    expect(fn).toContain("setLifted(null); requestBranch(node);");
  });
  it("the header never names a person", () => {
    expect(head).not.toMatch(/owner|author|teammate|added by|profile/i);
  });
});

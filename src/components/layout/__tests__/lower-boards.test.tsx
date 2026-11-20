// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * 21 Nov 2026, D-82: an admin's Boards section sits low in the menu and starts closed. It opens on a press, opens by
 * itself on a board so the admin sees where they are, and remembers open or closed for this tab only.
 */

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
  useMatchRoute: () => () => false,
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
  useRouterState: () => ({}),
}));

import { LowerBoards } from "@/components/layout/SidebarNav";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

const mount = (onBoard = false) =>
  render(
    <LowerBoards label="Boards" profileId="p1" onBoard={onBoard}>
      <div data-testid="board-tree">Pellham board</div>
    </LowerBoards>,
  );

describe("the admin's lower Boards section", () => {
  it("starts closed, opens on a press and closes again", () => {
    mount();
    const toggle = screen.getByTestId("nav-boards-toggle");
    expect(toggle.textContent).toContain("Boards");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("board-tree")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("board-tree")).toBeTruthy();
    fireEvent.click(toggle);
    expect(screen.queryByTestId("board-tree")).toBeNull();
  });

  it("opens by itself while the admin is on a board", () => {
    mount(true);
    expect(screen.getByTestId("nav-boards-toggle").getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("board-tree")).toBeTruthy();
  });

  it("remembers open for this tab, and still works when storage is refused", () => {
    mount();
    fireEvent.click(screen.getByTestId("nav-boards-toggle"));
    cleanup();
    mount();
    expect(screen.getByTestId("board-tree")).toBeTruthy();
    cleanup();
    const get = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("refused");
    });
    const set = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("refused");
    });
    try {
      mount();
      const toggle = screen.getByTestId("nav-boards-toggle");
      expect(toggle.getAttribute("aria-expanded")).toBe("false");
      fireEvent.click(toggle);
      expect(screen.getByTestId("board-tree")).toBeTruthy();
    } finally {
      get.mockRestore();
      set.mockRestore();
    }
  });
});

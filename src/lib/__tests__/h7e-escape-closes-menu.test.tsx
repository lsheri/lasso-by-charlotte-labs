// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import { ContinueInAI } from "@/components/canvas-lab/ask-draft/ContinueInAI";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

function open() {
  render(
    <ContinueInAI
      profileId="p"
      disabled={false}
      signals={{
        boardPushes: [{ vendor: "claude", at: "x" }],
        myPushes: [],
        connected: [],
        signin: false,
      }}
      build={vi.fn()}
      onDone={vi.fn()}
    />,
  );
  const button = screen.getByRole("button", { name: "Continue in Claude" });
  fireEvent.click(button);
  expect(screen.getByTestId("continue-menu")).toBeTruthy();
  return button;
}

describe("H7e Escape closes the Continue menu", () => {
  it("closes the menu and puts focus back on its button", () => {
    const button = open();
    fireEvent.keyDown(screen.getAllByRole("menuitem")[0]!, { key: "Escape" });
    expect(screen.queryByTestId("continue-menu")).toBeNull();
    expect(document.activeElement).toBe(button);
  });
  it("the board never sees that Escape, so picked cards stay picked", () => {
    open();
    const board = vi.fn();
    window.addEventListener("keydown", board);
    fireEvent.keyDown(document.body, { key: "Escape" });
    window.removeEventListener("keydown", board);
    expect(board).not.toHaveBeenCalled();
  });
  it("other keys do nothing, and with the menu closed Escape passes through", () => {
    open();
    fireEvent.keyDown(document.body, { key: "Enter" });
    expect(screen.getByTestId("continue-menu")).toBeTruthy();
    fireEvent.keyDown(document.body, { key: "Escape" });
    const board = vi.fn();
    window.addEventListener("keydown", board);
    fireEvent.keyDown(document.body, { key: "Escape" });
    window.removeEventListener("keydown", board);
    expect(board).toHaveBeenCalledTimes(1);
  });
});

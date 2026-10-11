// @vitest-environment jsdom
/**
 * BB-1: keys typed into a box belong to that box.
 * CanvasLabPage is too data-bound to mount here, so the guard is driven for real
 * through a window keydown wired exactly as the page wires it, and the page's own
 * wiring (guard before delete, restore re-reads the archive's version) is pinned as source.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
const { isTypingTarget } = await import("@/pages/CanvasLabPage");

const source = readFileSync(resolve(__dirname, "../../pages/CanvasLabPage.tsx"), "utf8");

function mount() {
  const board = document.createElement("div");
  board.tabIndex = 0;
  board.innerHTML = `<input id="i"/><textarea id="t"></textarea><div contenteditable="true" id="c"><span id="cs">x</span></div><select id="s"></select>`;
  document.body.appendChild(board);
  const deleteCard = vi.fn();
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== "Delete" && event.key !== "Backspace") return;
    if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return;
    deleteCard();
  };
  window.addEventListener("keydown", onKey);
  return { board, deleteCard, off: () => window.removeEventListener("keydown", onKey) };
}

afterEach(() => { document.body.innerHTML = ""; });

describe("BB-1 typing keys", () => {
  for (const id of ["i", "t", "c", "cs", "s"]) {
    for (const key of ["Backspace", "Delete"]) {
      it(`${key} inside #${id} does not delete the highlighted card`, () => {
        const { deleteCard, off } = mount();
        const el = document.getElementById(id)!;
        el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        expect(deleteCard).not.toHaveBeenCalled();
        off();
      });
    }
  }

  it("Backspace with focus on the board deletes the card", () => {
    const { board, deleteCard, off } = mount();
    board.focus();
    board.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
    expect(deleteCard).toHaveBeenCalledTimes(1);
    off();
  });

  it("the page guards Delete/Backspace before any delete runs", () => {
    const branch = source.indexOf('if (event.key !== "Delete" && event.key !== "Backspace") return;');
    const guard = source.indexOf("if (isTypingTarget(event.target) || isTypingTarget(document.activeElement)) return;");
    const del = source.indexOf("deleteNode(node);", branch);
    expect(branch).toBeGreaterThan(0);
    expect(guard).toBeGreaterThan(branch);
    expect(guard).toBeLessThan(del);
  });

  it("undo restore re-reads the version the archive left behind", () => {
    expect(source).toContain("void restoreVersion(durableId, fallback).then((version) => lab.persist({ type: \"node_restore\", nodeId: durableId, expectedVersion: version }))");
    expect(source).toContain("result.status === \"saved\" ? result.versions[durableId] ?? expectedVersion + 1 : null");
  });
});

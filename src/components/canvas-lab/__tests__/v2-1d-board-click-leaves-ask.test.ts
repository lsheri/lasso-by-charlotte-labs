// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: () => ({}) } }));

import { pressLeavesAsk } from "@/components/canvas-lab/ask-draft/AskDraftSurface";

function dom() {
  document.body.innerHTML = `
    <div id="board"><div id="card"></div></div>
    <section id="ask"><textarea id="box"></textarea></section>
    <div role="menu" id="menu"><button id="item"></button></div>
    <div data-radix-popper-content-wrapper><div id="pop"></div></div>
    <div role="dialog"><button id="dlg"></button></div>`;
  return document.getElementById("ask")!;
}

describe("V2-1d a press outside Ask takes focus out of it", () => {
  it("the empty board or a card counts as outside", () => {
    const ask = dom();
    expect(pressLeavesAsk(document.getElementById("board"), ask)).toBe(true);
    expect(pressLeavesAsk(document.getElementById("card"), ask)).toBe(true);
  });
  it("a press inside Ask, or in a menu, popup or dialog it opened, does not", () => {
    const ask = dom();
    expect(pressLeavesAsk(document.getElementById("box"), ask)).toBe(false);
    expect(pressLeavesAsk(document.getElementById("item"), ask)).toBe(false);
    expect(pressLeavesAsk(document.getElementById("pop"), ask)).toBe(false);
    expect(pressLeavesAsk(document.getElementById("dlg"), ask)).toBe(false);
    expect(pressLeavesAsk(null, ask)).toBe(false);
  });
});

describe("V2-1d wiring", () => {
  const src = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
  const effect = src.slice(
    src.indexOf("// V2-1d (ask-v2)"),
    src.indexOf("const { refresh } = dock;"),
  );
  it("only under ask-v2 and only while focus is in Ask", () => {
    expect(effect).toContain("if (!askV2 || !focusedIn) return;");
  });
  it("listens in the capture phase, so the board's own handlers cannot hide the press", () => {
    expect(effect).toContain('document.addEventListener("pointerdown", onPress, true);');
    expect(effect).toContain('document.removeEventListener("pointerdown", onPress, true);');
  });
  it("blurs only an element inside Ask, then lets the idle row come back", () => {
    expect(effect).toContain(
      "if (active instanceof HTMLElement && surface.contains(active)) active.blur();",
    );
    expect(effect).toContain("setFocusedIn(false);");
  });
  it("never primes (V2-1 rule 1)", () => {
    expect(effect).not.toMatch(/prime/i);
  });
});

/** @vitest-environment jsdom */
import { describe, expect, it } from "vitest";

import { resolveTurnSelection } from "../turn-selection";

function mount(html: string): HTMLElement {
  const host = document.createElement("div");
  host.innerHTML = html;
  document.body.append(host);
  return host;
}

describe("resolving a selection to one turn", () => {
  it("reads offsets inside the turn's own text", () => {
    const host = mount(
      `<div data-turn-no="2"><span class="label">Turn 2 · assistant</span>` +
        `<div data-turn-content="2">The pricing floor is 40 percent.</div></div>`,
    );
    const text = host.querySelector("[data-turn-content]")!.firstChild!;
    const range = document.createRange();
    range.setStart(text, 4);
    range.setEnd(text, 17);

    const result = resolveTurnSelection(range);
    expect(result).toEqual({
      kind: "ok",
      selection: { turnNo: 2, charStart: 4, charEnd: 17, text: "pricing floor" },
    });
  });

  it("counts text across nested marks in the same turn", () => {
    const host = mount(
      `<div data-turn-content="1">one <mark>two</mark> three</div>`,
    );
    const container = host.querySelector("[data-turn-content]")!;
    const tail = container.lastChild!;
    const range = document.createRange();
    range.setStart(container.firstChild!, 0);
    range.setEnd(tail, 6);
    const result = resolveTurnSelection(range);
    expect(result).toMatchObject({ kind: "ok", selection: { charStart: 0, charEnd: 13 } });
  });

  it("refuses a selection that crosses two turns", () => {
    const host = mount(
      `<div data-turn-content="1">first turn</div><div data-turn-content="2">second turn</div>`,
    );
    const nodes = host.querySelectorAll("[data-turn-content]");
    const range = document.createRange();
    range.setStart(nodes[0]!.firstChild!, 2);
    range.setEnd(nodes[1]!.firstChild!, 4);
    expect(resolveTurnSelection(range).kind).toBe("cross_turn");
  });

  it("ignores a selection outside any turn", () => {
    const host = mount(`<p>just some chrome</p>`);
    const range = document.createRange();
    range.selectNodeContents(host.firstChild!);
    expect(resolveTurnSelection(range).kind).toBe("none");
  });
});

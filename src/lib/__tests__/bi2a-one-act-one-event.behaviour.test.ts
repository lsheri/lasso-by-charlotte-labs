import { describe, expect, it } from "vitest";
import { CARD_CONFIRM_MS, cardContextCall, createCardClickController, type CardSelectVia } from "@/lib/card-click";

/** A fake page: applies cardContextCall exactly as CanvasLabPage's onSelect does. */
function harness() {
  const events: string[] = [];
  let inContext = false;
  const timers = new Map<number, () => void>();
  let next = 1;
  const select = (via: CardSelectVia) => {
    const call = cardContextCall(via);
    if (call.record) events.push(call.record);
    if (call.toggle) inContext = !inContext;
  };
  const controller = createCardClickController<number>({
    select,
    schedule: (run, ms) => { expect(ms).toBe(CARD_CONFIRM_MS); const id = next++; timers.set(id, run); return id; },
    cancel: (id) => { timers.delete(id); },
  });
  const elapse = () => { const runs = [...timers.values()]; timers.clear(); runs.forEach((run) => run()); };
  return { events, select, controller, elapse, context: () => inContext };
}

describe("BI-2a context events", () => {
  it("a body click selects at once and records card once the window passes", () => {
    const h = harness();
    h.controller.click();
    expect(h.context()).toBe(true);
    expect(h.events).toEqual([]);
    h.elapse();
    expect(h.events).toEqual(["card"]);
  });

  it("a menu select still records menu", () => {
    const h = harness();
    h.select("menu");
    expect(h.events).toEqual(["menu"]);
    expect(h.context()).toBe(true);
  });

  it("a double-click records no context event and leaves context unchanged", () => {
    const h = harness();
    h.controller.click();
    expect(h.controller.pending()).toBe(true);
    h.controller.undo();
    h.elapse();
    expect(h.events).toEqual([]);
    expect(h.context()).toBe(false);
  });

  it("two separate clicks record two card events", () => {
    const h = harness();
    h.controller.click();
    h.elapse();
    h.controller.click();
    h.elapse();
    expect(h.events).toEqual(["card", "card"]);
    expect(h.context()).toBe(false);
  });

  it("unmounting with a waiting click still records it once", () => {
    const h = harness();
    h.controller.click();
    h.controller.flush();
    h.elapse();
    expect(h.events).toEqual(["card"]);
  });
});

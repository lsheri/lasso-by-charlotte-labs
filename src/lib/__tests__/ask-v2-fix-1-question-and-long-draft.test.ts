// @vitest-environment jsdom
// ASK-V2-FIX-1 (10 Nov, seen live on the preview): the question stays in view while Lasso works, and a question
// longer than the idle bar opens the panel instead of scrolling sideways out of sight.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { alignTopIn, questionInFlight, topInView } from "@/components/reflect/use-ask-lasso";

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

describe("ASK-V2-FIX-1 the question in flight", () => {
  it("is the question just sent, else the last question in the thread", () => {
    const thread = document.createElement("div");
    thread.innerHTML = '<div data-turn-role="user" id="q1"></div><div data-turn-role="assistant"></div><div data-turn-role="user" id="q2"></div><div id="end"></div>';
    const end = thread.querySelector<HTMLElement>("#end")!;
    expect(questionInFlight(end)?.id).toBe("q2");
    const now = document.createElement("div");
    now.setAttribute("data-testid", "asked-now");
    now.id = "now";
    thread.insertBefore(now, end);
    expect(questionInFlight(end)?.id).toBe("now");
  });
  it("is scrolled to the top of the panel, with a little room above it", () => {
    const area = document.createElement("div");
    const q = document.createElement("div");
    area.getBoundingClientRect = () => rect(430, 400);
    q.getBoundingClientRect = () => rect(400, 40);
    area.scrollTop = 100;
    const scrollTo = vi.fn((o: ScrollToOptions) => { area.scrollTop = o.top ?? 0; });
    area.scrollTo = scrollTo as unknown as typeof area.scrollTo;
    expect(topInView(q, area)).toBe(false);
    alignTopIn(q, area, "smooth");
    expect(scrollTo).toHaveBeenCalledWith({ top: 62, behavior: "smooth" });
  });
  it("counts as in view once its top is inside the panel", () => {
    const area = document.createElement("div");
    const q = document.createElement("div");
    area.getBoundingClientRect = () => rect(430, 400);
    q.getBoundingClientRect = () => rect(438, 40);
    expect(topInView(q, area)).toBe(true);
  });
});

describe("ASK-V2-FIX-1 wiring (pinned in source)", () => {
  const hook = readFileSync("src/components/reflect/use-ask-lasso.ts", "utf8");
  const surface = readFileSync("src/components/reflect/AskSurface.tsx", "utf8");
  const dock = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");
  it("both scrolls anchor on the question first", () => {
    expect(hook).toContain('if (question && scroller) { alignTopIn(question, scroller, "smooth"); return; }');
    expect(hook).toContain('if (question) { if (!topInView(question, scroller)) alignTopIn(question, scroller, "auto"); return; }');
  });
  it("each thread message says who spoke, so the last question can be found", () => {
    expect(surface).toContain("data-turn-role={role}");
  });
  it("a long draft opens the panel and stays open until the box is empty", () => {
    expect(dock).toContain("&& !draftLong;");
    expect(dock).toContain("if (!ask.draft) { setDraftLong(false); return; }");
    expect(dock).toContain("if (box && box.scrollWidth > box.clientWidth + 1) setDraftLong(true);");
  });
});

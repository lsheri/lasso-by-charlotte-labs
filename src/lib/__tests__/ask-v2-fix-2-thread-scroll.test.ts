// @vitest-environment jsdom
// ASK-V2-FIX-2 (10 Nov, measured live on the preview after FIX-1): when the thread refetched, the panel scrolled to
// the very end. The question sat 117 px above view while Gathering, and a finished answer opened on its last lines.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

import { showLatestQuestion } from "@/components/reflect/use-ask-lasso";

function rect(top: number, height: number): DOMRect {
  return { top, bottom: top + height, height, left: 0, right: 300, width: 300, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
}

function panel(html: string) {
  const area = document.createElement("div");
  area.style.overflowY = "auto";
  const thread = document.createElement("div");
  thread.innerHTML = `${html}<div id="end"></div>`;
  area.appendChild(thread);
  document.body.appendChild(area);
  area.getBoundingClientRect = () => rect(430, 400);
  area.scrollTop = 900;
  const scrollTo = vi.fn((o: ScrollToOptions) => { area.scrollTop = o.top ?? 0; });
  area.scrollTo = scrollTo as unknown as typeof area.scrollTo;
  return { area, scrollTo, end: thread.querySelector<HTMLElement>("#end")! };
}

describe("ASK-V2-FIX-2 the latest question goes to the top, not the end of the thread", () => {
  it("a finished answer opens on its question, with the answer reading down from it", () => {
    const { scrollTo, end, area } = panel('<div data-turn-role="user"></div><div data-turn-role="assistant"></div><div data-turn-role="user" id="q"></div><div data-turn-role="assistant"></div>');
    area.querySelector<HTMLElement>("#q")!.getBoundingClientRect = () => rect(-270, 40);
    expect(showLatestQuestion(end)).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 192, behavior: "smooth" });
  });
  it("while Lasso works, the question just sent is the one shown", () => {
    const { scrollTo, end, area } = panel('<div data-turn-role="user"></div><div data-testid="asked-now" id="now"></div>');
    area.querySelector<HTMLElement>("#now")!.getBoundingClientRect = () => rect(313, 40);
    expect(showLatestQuestion(end)).toBe(true);
    expect(scrollTo).toHaveBeenCalledWith({ top: 775, behavior: "smooth" });
  });
  it("with no question yet, it leaves the scroll to the old end-of-thread rule", () => {
    const { scrollTo, end } = panel("");
    expect(showLatestQuestion(end)).toBe(false);
    expect(scrollTo).not.toHaveBeenCalled();
  });
});

describe("ASK-V2-FIX-2 wiring (pinned in source)", () => {
  it("the thread-change scroll tries the question first", () => {
    const hook = readFileSync("src/components/reflect/use-ask-lasso.ts", "utf8");
    expect(hook).toContain("if (anchor && showLatestQuestion(anchor)) return;");
    expect(hook).toContain('anchor?.scrollIntoView({ behavior: "smooth" });\n  }, [messages?.length, pending, asked]);');
  });
});

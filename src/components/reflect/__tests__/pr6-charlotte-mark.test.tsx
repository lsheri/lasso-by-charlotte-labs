// @vitest-environment jsdom
// Phase 3 PR6: LassoThinkingMark renders the Charlotte mark under the Charlotte skin; Lasso keeps its canvas.
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LassoThinkingMark } from "@/components/reflect/LassoThinkingMark";
import { SkinContext } from "@/components/skin/use-skin";
import type { Skin } from "@/lib/skin";

function inSkin(skin: Skin, node: React.ReactElement) {
  return <SkinContext.Provider value={skin}>{node}</SkinContext.Provider>;
}

describe("LassoThinkingMark under Charlotte", () => {
  let raf: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });
  afterEach(() => vi.restoreAllMocks());

  it("keeps the canvas with no provider and with the Lasso skin", () => {
    for (const node of [
      <LassoThinkingMark kind="signature" size={22} thinking persistent />,
      inSkin("lasso", <LassoThinkingMark kind="signature" size={22} thinking persistent />),
    ]) {
      const { container } = render(node);
      const el = container.firstElementChild!;
      expect(el.tagName).toBe("CANVAS");
      expect(el.getAttribute("data-lasso-thinking-mark")).toBe("signature");
      expect(container.querySelector("svg")).toBeNull();
    }
  });

  it("shows the toolbar's persistent mark as the still C, with the canvas's data attributes", () => {
    const { container } = render(
      inSkin("charlotte", <LassoThinkingMark kind="signature" size={22} thinking persistent className="ask-mark" />),
    );
    const host = container.firstElementChild!;
    expect(host.tagName).toBe("SPAN");
    expect(host.getAttribute("class")).toBe("ask-mark");
    expect(host.getAttribute("aria-hidden")).toBe("true");
    expect(host.getAttribute("data-lasso-thinking-mark")).toBe("signature");
    expect(host.getAttribute("data-thinking")).toBe("true");
    expect(host.getAttribute("data-rope")).toBe("true");
    const svg = host.querySelector("svg")!;
    expect(svg.getAttribute("data-charlotte-mark")).toBe("idle");
    expect(svg.getAttribute("class")).toBe("wm idle");
    expect(svg.getAttribute("data-size")).toBe("22");
    expect(raf).not.toHaveBeenCalled();
  });

  it("grows the web only while actually reading", () => {
    const reading = render(inSkin("charlotte", <LassoThinkingMark kind="signature" size={40} thinking />));
    expect(reading.container.querySelector("svg")!.getAttribute("data-charlotte-mark")).toBe("reading");
    expect(raf).toHaveBeenCalled();

    raf.mockClear();
    const answered = render(inSkin("charlotte", <LassoThinkingMark kind="signature" size={40} />));
    expect(answered.container.querySelector("svg")!.getAttribute("class")).toBe("wm idle");
    expect(answered.container.firstElementChild!.getAttribute("data-thinking")).toBe("false");
    expect(raf).not.toHaveBeenCalled();
  });

  it("pins a still, thinking mark part-grown with no loop", () => {
    const { container } = render(inSkin("charlotte", <LassoThinkingMark kind="signature" size={40} thinking still />));
    expect(container.querySelector("svg")!.getAttribute("class")).toBe("wm reading");
    expect(raf).not.toHaveBeenCalled();
  });

  it("treats the older indicator kinds as reading", () => {
    for (const kind of ["orbit", "loop", "gather", "trace"] as const) {
      const { container } = render(inSkin("charlotte", <LassoThinkingMark kind={kind} size={40} />));
      expect(container.firstElementChild!.getAttribute("data-lasso-thinking-mark")).toBe(kind);
      expect(container.firstElementChild!.hasAttribute("data-thinking")).toBe(false);
      expect(container.querySelector("svg")!.getAttribute("data-charlotte-mark")).toBe("reading");
    }
  });

  it("survives a skin change mid-session", () => {
    const mark = <LassoThinkingMark kind="signature" size={22} thinking persistent />;
    const { container, rerender } = render(inSkin("lasso", mark));
    expect(container.firstElementChild!.tagName).toBe("CANVAS");
    rerender(inSkin("charlotte", mark));
    expect(container.firstElementChild!.tagName).toBe("SPAN");
    rerender(inSkin("lasso", mark));
    expect(container.firstElementChild!.tagName).toBe("CANVAS");
  });
});

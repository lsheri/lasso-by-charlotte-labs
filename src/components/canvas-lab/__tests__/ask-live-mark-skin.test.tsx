// @vitest-environment jsdom
// 15 Nov: the Ask box drew its own Lasso loop under Charlotte. It now follows the skin like every other mark.
import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AskLiveMark } from "@/components/canvas-lab/ask-draft/AskLiveMark";
import { SkinContext } from "@/components/skin/use-skin";
import type { Skin } from "@/lib/skin";

// 19 Nov: Slate / Spool script (Lasso) is the default look now. This file tests the Charlotte look, which allowed
// accounts can still choose, so it pins the earlier default. The default itself is tested in slate-spool-brand.test.tsx.
vi.mock("@/lib/brand-variant-shared", async (original) => ({
  ...(await original<typeof import("@/lib/brand-variant-shared")>()),
  DEFAULT_BRAND_VARIANT: "current",
}));

function inSkin(skin: Skin, node: React.ReactElement) {
  return <SkinContext.Provider value={skin}>{node}</SkinContext.Provider>;
}

describe("AskLiveMark follows the skin", () => {
  beforeEach(() => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("draws the C under Charlotte, never the loop", () => {
    const { container } = render(inSkin("charlotte", <AskLiveMark pending={false} error={false} turnKey="t" />));
    expect(container.querySelector('[data-brand-mark="lasso"]')).toBeNull();
    expect(container.querySelector('[data-brand-mark="charlotte"]')?.getAttribute("data-charlotte-mark")).toBe("live");
  });

  it("grows the web while reading and goes all ink on a failed send", () => {
    const reading = render(inSkin("charlotte", <AskLiveMark pending error={false} turnKey="t" />));
    expect(reading.container.querySelector("[data-charlotte-mark]")?.getAttribute("data-charlotte-mark")).toBe("reading");
    reading.unmount();
    const failed = render(inSkin("charlotte", <AskLiveMark pending={false} error turnKey="t" />));
    expect(failed.container.querySelector("[data-charlotte-mark]")?.getAttribute("data-charlotte-mark")).toBe("idle");
  });

  it("keeps the tagged loop in Lasso", () => {
    const { container } = render(inSkin("lasso", <AskLiveMark pending={false} error={false} turnKey="t" />));
    expect(container.querySelector('svg[data-brand-mark="lasso"]')).not.toBeNull();
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  BUNDLE_GAP,
  BUNDLE_INDENT,
  BUNDLE_MORE_TILE,
  applyBundleViews,
  bundleControlScale,
  bundlePiecesBand,
  bundleReserveHeight,
  readBundleViews,
  visibleBundlePieces,
  workboardBundlesKey,
  writeBundleViews,
} from "@/components/canvas-lab/canvas-lab-model";

const six = ["p1", "p2", "p3", "p4", "p5", "p6"];

describe("B2 visible-piece rule", () => {
  it("expanded caps at four with a tile for the rest", () => {
    expect(visibleBundlePieces(six, "expanded")).toEqual({ shown: ["p1", "p2", "p3", "p4"], more: 2 });
    expect(visibleBundlePieces(six.slice(0, 4))).toEqual({ shown: ["p1", "p2", "p3", "p4"], more: 0 });
  });
  it("all_shown shows all, minimized shows none", () => {
    expect(visibleBundlePieces(six, "all_shown")).toEqual({ shown: six, more: 0 });
    expect(visibleBundlePieces(six, "minimized")).toEqual({ shown: [], more: 0 });
  });
  it("applies views by the chat's work item id, never hiding anything", () => {
    const bundles = new Map([["work:c", six], ["work:d", ["q1"]]]);
    const result = applyBundleViews(bundles, { c: "minimized" }, (id) => id.replace("work:", ""));
    expect(result.bundles.has("work:c")).toBe(false);
    expect([...result.dropped].sort()).toEqual(six);
    expect(result.minimized.get("work:c")).toBe(6);
    expect(result.bundles.get("work:d")).toEqual(["q1"]);
    const expanded = applyBundleViews(bundles, {}, (id) => id.replace("work:", ""));
    expect(expanded.more.get("work:c")).toBe(2);
    expect([...expanded.dropped].sort()).toEqual(["p5", "p6"]);
  });
  it("the seed reserves room for four pieces and the tile, not for all of them", () => {
    expect(bundleReserveHeight(2, 220)).toBe(2 * (220 + BUNDLE_GAP));
    expect(bundleReserveHeight(9, 220)).toBe(4 * (220 + BUNDLE_GAP) + BUNDLE_MORE_TILE.height + BUNDLE_GAP);
    expect(bundleReserveHeight(0, 220)).toBe(0);
  });
  it("bands the piece count", () => {
    expect([bundlePiecesBand(1), bundlePiecesBand(3), bundlePiecesBand(5)]).toEqual(["1", "2_4", "5_plus"]);
  });
  it("uses the 18px indent and caps control growth below 60% zoom", () => {
    expect(BUNDLE_INDENT).toBe(18);
    expect(bundleControlScale(1)).toBe(1);
    expect(bundleControlScale(0.6)).toBeCloseTo(1 / 0.6);
    expect(bundleControlScale(0.4)).toBeCloseTo(1 / 0.6);
  });
});

describe("B2 per-viewer storage", () => {
  it("uses the agreed key", () => {
    expect(workboardBundlesKey("prof", "eng")).toBe("lasso:workboard:prof:eng:bundles");
  });
  it("round-trips, and keeps working when storage throws", () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    writeBundleViews(storage, "k", { a: "minimized", b: "all_shown", c: "expanded" });
    expect(readBundleViews(storage, "k")).toEqual({ a: "minimized", b: "all_shown" });
    const throwing = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readBundleViews(throwing, "k")).toEqual({});
    expect(() => writeBundleViews(throwing, "k", { a: "minimized" })).not.toThrow();
    expect(readBundleViews({ getItem: () => "not json" }, "k")).toEqual({});
  });
});

describe("B2 board wiring", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  it("fires bundle_toggled on a click or menu choice, not on restore", () => {
    const restore = page.slice(page.indexOf("const [bundleViews, setBundleViews]"), page.indexOf("const bundleView = useMemo"));
    expect(restore).toContain("readBundleViews(");
    expect(restore).not.toContain("noteWorkboardBundleToggled");
    const toggle = page.slice(page.indexOf("function toggleBundle("), page.indexOf("function moveToFrame("));
    expect(toggle).toContain("noteWorkboardBundleToggled(orgId, state, bundlePiecesBand(pieces), via);");
    expect(page).toContain('toggleBundle(chat, state, "control")');
    expect(page).toContain('"menu")');
  });
  it("keeps the copy exact", () => {
    const controls = readFileSync("src/components/canvas-lab/LabBundleControls.tsx", "utf8");
    expect(controls).toContain('`${count} ${count === 1 ? "piece" : "pieces"} from this chat`');
    expect(controls).toContain("+{extra} more from this chat");
    expect(controls).toContain(">Minimize<");
    expect(page).toContain('"Show pieces" : "Minimize pieces"');
  });
  it("names every bundle control with its chat and keeps the line spine at half the indent", () => {
    const controls = readFileSync("src/components/canvas-lab/LabBundleControls.tsx", "utf8");
    const links = readFileSync("src/components/canvas-lab/LabBundleLinks.tsx", "utf8");
    expect(controls).toContain('aria-label={`Minimize pieces from ${chat.title}`}');
    expect(controls).toContain('aria-label={`Show ${count} ${count === 1 ? "piece" : "pieces"} from ${chat.title}`}');
    expect(controls).toContain('aria-label={`Show all ${pieceIds.length + extra} pieces from ${chat.title}`}');
    expect(controls).toContain("bundleControlScale(zoom)");
    expect(links).toContain("const spineX = chat.x + 9;");
  });
});

describe("B2.1 a minimized chat still carries its pieces", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  it("moveToFrame looks pieces up in the stored list, never visibleNodes", () => {
    const body = page.slice(page.indexOf("function moveToFrame("), page.indexOf("function addNode("));
    expect(body).toContain("const pieceIds = bundles.get(node.id) ?? [];");
    expect(body).toContain("pieceIds.map((id) => allNodes.find((entry) => entry.id === id))");
    expect(body).not.toContain("visibleNodes");
  });
  it("bundles are derived before minimize filtering", () => {
    const bundlesAt = page.indexOf("const bundles = useMemo(() => chatBundles(shownNodes, workItems)");
    const viewAt = page.indexOf("const bundleView = useMemo");
    const visibleAt = page.indexOf("const visibleNodes = useMemo(");
    expect(bundlesAt).toBeGreaterThan(-1);
    expect(bundlesAt).toBeLessThan(viewAt);
    expect(viewAt).toBeLessThan(visibleAt);
  });
});

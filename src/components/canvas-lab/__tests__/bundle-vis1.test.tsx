import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LabBundleLinks } from "@/components/canvas-lab/LabBundleLinks";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

const NODES: LabNode[] = [
  { id: "chat", kind: "chat", title: "Chat", summary: "", typeLabel: "Chat", ownership: "yours", x: 0, y: 0, width: 260, height: 220 },
  { id: "piece", kind: "work", title: "Piece", summary: "", typeLabel: "Document", ownership: "yours", x: 18, y: 252, width: 260, height: 220 },
];

it("stems a Claude chat's bundle in the Claude vendor colour at 2px", () => {
  const html = renderToStaticMarkup(
    <svg><LabBundleLinks nodes={NODES} bundles={new Map([["chat", ["piece"]]])} vendorByChat={new Map([["chat", "claude"]])} /></svg>,
  );
  const stem = html.match(/<path\b[^>]*>/)?.[0];
  expect(stem).toBeDefined();
  expect(stem).toContain('stroke="var(--vendor-claude)"');
  expect(stem).toContain('stroke-width="2"');
  expect(html).toContain('fill="var(--vendor-claude)"');
});

it("falls back to the unknown vendor colour when the vendor is missing or null", () => {
  const noEntry = renderToStaticMarkup(
    <svg><LabBundleLinks nodes={NODES} bundles={new Map([["chat", ["piece"]]])} /></svg>,
  );
  expect(noEntry.match(/<path\b[^>]*>/)?.[0]).toContain('stroke="var(--vendor-unknown)"');
  const nullVendor = renderToStaticMarkup(
    <svg><LabBundleLinks nodes={NODES} bundles={new Map([["chat", ["piece"]]])} vendorByChat={new Map([["chat", null]])} /></svg>,
  );
  expect(nullVendor.match(/<path\b[^>]*>/)?.[0]).toContain('stroke="var(--vendor-unknown)"');
});

/**
 * VENDOR-COLOUR-1b: on a real board a pushed chat is a kind "work" node. kind "chat" is
 * only ever a local draft, so a vendor map built by filtering node kinds comes back empty
 * on every production board and every stem, tint and stack edge falls back to grey.
 */
const BOARD_NODES: LabNode[] = [
  { id: "work:chat-1", kind: "work", title: "Claude thread", summary: "", typeLabel: "Chat", ownership: "yours", workItemId: "w-chat", x: 0, y: 0, width: 260, height: 220 },
  { id: "work:piece-1", kind: "work", title: "Report", summary: "", typeLabel: "Document", ownership: "yours", workItemId: "w-piece", x: 18, y: 252, width: 260, height: 220 },
];

const BOARD_ITEMS = [
  { id: "w-chat", source_vendor: "claude" },
  { id: "w-piece", source_vendor: "claude" },
];

/** Mirrors the vendorByChat memo in CanvasLabPage.tsx. The source pin below keeps the two in step. */
function vendorByChatFor(
  bundles: Map<string, string[]>,
  nodes: readonly LabNode[],
  items: readonly { id: string; source_vendor: string | null }[],
) {
  const map = new Map<string, string | null>();
  for (const chatId of bundles.keys()) {
    const node = nodes.find((entry) => entry.id === chatId);
    const item = node?.workItemId ? items.find((entry) => entry.id === node.workItemId) : undefined;
    map.set(chatId, item?.source_vendor ?? null);
  }
  return map;
}

it("stems a pushed chat whose board node is kind work, the shape production boards actually have", () => {
  const bundles = new Map([["work:chat-1", ["work:piece-1"]]]);
  const html = renderToStaticMarkup(
    <svg><LabBundleLinks nodes={BOARD_NODES} bundles={bundles} vendorByChat={vendorByChatFor(bundles, BOARD_NODES, BOARD_ITEMS)} /></svg>,
  );
  expect(html.match(/<path\b[^>]*>/)?.[0]).toContain('stroke="var(--vendor-claude)"');
});

it("keys vendorByChat off the bundle chats, never off a node kind", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const start = page.indexOf("const vendorByChat = useMemo(");
  expect(start).toBeGreaterThan(-1);
  const deps = page.indexOf("}, [", start);
  const block = page.slice(start, page.indexOf("]);", deps) + 3);
  expect(block).toContain("for (const chatId of bundles.keys())");
  expect(block).not.toContain("kind");
});

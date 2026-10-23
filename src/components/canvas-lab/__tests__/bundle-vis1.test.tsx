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

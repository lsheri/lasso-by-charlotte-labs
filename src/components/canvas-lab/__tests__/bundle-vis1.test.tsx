import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { LabBundleLinks } from "@/components/canvas-lab/LabBundleLinks";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

it("keeps the bundle stem in the theme-aware accent at 2px", () => {
  const nodes = [
    { id: "chat", kind: "chat", x: 0, y: 0, width: 260, height: 220 },
    { id: "piece", kind: "document", x: 18, y: 252, width: 260, height: 220 },
  ] as LabNode[];
  const html = renderToStaticMarkup(<svg><LabBundleLinks nodes={nodes} bundles={new Map([["chat", ["piece"]]])} /></svg>);
  const stem = html.match(/<path\b[^>]*>/)?.[0];
  expect(stem).toBeDefined();
  expect(stem).toContain('stroke="var(--accent-deep)"');
  expect(stem).toContain('stroke-width="2"');
});
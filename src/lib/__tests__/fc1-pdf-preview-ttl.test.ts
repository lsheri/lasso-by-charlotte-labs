import { describe, expect, it } from "vitest";

import { isStalePreview } from "@/hooks/use-workboard-file-previews";
import type { WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";

const NOW = 1_000_000_000;
function entry(kind: WorkboardFilePreview["kind"], ageSeconds: number) {
  const preview = { workItemId: "w", kind, url: kind === "pdf" ? "https://x" : null, lines: [], slideTitle: null, versionCount: 0 } as WorkboardFilePreview;
  return { preview, mintedAt: NOW - ageSeconds * 1000 };
}

describe("FACE-1 pdf preview expiry", () => {
  it("a pdf minted 10 seconds ago is fresh", () => {
    expect(isStalePreview(entry("pdf", 10), NOW)).toBe(false);
  });
  it("a pdf minted 600 seconds ago is stale", () => {
    expect(isStalePreview(entry("pdf", 600), NOW)).toBe(true);
  });
  it("a text preview minted 600 seconds ago is not stale", () => {
    expect(isStalePreview(entry("text", 600), NOW)).toBe(false);
  });
  it("a slide preview minted 600 seconds ago is not stale", () => {
    expect(isStalePreview(entry("slide", 600), NOW)).toBe(false);
  });
});

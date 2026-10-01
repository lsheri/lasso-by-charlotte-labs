import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { guardEventDims } from "@/lib/event-dim-allowlist";

const reviewSource = readFileSync(resolve(__dirname, "../../components/canvas-lab/CanvasLabReview.tsx"), "utf8");
const focusSource = readFileSync(resolve(__dirname, "../../components/canvas-lab/FocusOverlay.tsx"), "utf8");
const hookSource = readFileSync(resolve(__dirname, "../../hooks/use-work-file-download.ts"), "utf8");

describe("d1 · board view downloads", () => {
  it("the review view no longer stubs onDownload", () => {
    expect(reviewSource).not.toContain("onDownload={() => undefined}");
    expect(reviewSource).toContain("useWorkFileDownload(");
  });

  it("the focus overlay no longer stubs onDownload", () => {
    expect(focusSource).not.toContain("onDownload={() => undefined}");
    expect(focusSource).toContain("useWorkFileDownload(");
  });

  it("the hook downloads through an anchor click, never a new window", () => {
    expect(hookSource).not.toContain("window.open");
    expect(hookSource).toContain(".click()");
  });

  it("work.file_downloaded keeps only the surface dim", () => {
    expect(guardEventDims("work.file_downloaded", { surface: "review", filename: "x.pdf" }).dims).toEqual({ surface: "review" });
  });
});

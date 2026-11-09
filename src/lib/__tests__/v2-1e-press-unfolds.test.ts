import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync("src/components/canvas-lab/ask-draft/AskDraftSurface.tsx", "utf8");

describe("V2-1e: pressing into the Ask box reopens a collapsed chat", () => {
  it("pointer down on the textarea unfolds a folded chat", () => {
    expect(src).toContain("if (event.target instanceof HTMLTextAreaElement && foldedRef.current) setFolded(false); dock.bind.onPointerDown(event);");
  });
  it("focus still unfolds as before", () => {
    expect(src).toContain("if (event.target instanceof HTMLTextAreaElement) setFolded(false); }}");
  });
});

import { describe, expect, it } from "vitest";

import { validateFrameArchive, validateFrameLabel } from "@/lib/canvas-lab.server";

describe("Canvas Lab frame server guards", () => {
  it("refuses to rename a task workstream", () => {
    expect(validateFrameLabel("task", "A new title")).toBe("Only a custom workstream can be renamed.");
  });

  it("bounds and trims custom workstream names", () => {
    expect(validateFrameLabel("custom", "   ")).toBe("A workstream name must be between 1 and 60 characters.");
    expect(validateFrameLabel("custom", "x".repeat(61))).toBe("A workstream name must be between 1 and 60 characters.");
    expect(validateFrameLabel("custom", "  Risks  ")).toBeNull();
  });

  it("refuses to archive a workstream with a live card", () => {
    expect(validateFrameArchive("custom", 1)).toBe("Move its cards first.");
  });

  it("allows an empty custom workstream to be archived", () => {
    expect(validateFrameArchive("custom", 0)).toBeNull();
    expect(validateFrameArchive("task", 0)).toBe("Only a custom workstream can be removed.");
  });
});
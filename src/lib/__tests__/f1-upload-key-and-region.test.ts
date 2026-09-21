import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { applyDurableBoard, containFrameMembers, FRAME_MIN_HEIGHT, FRAME_MIN_WIDTH } from "@/components/canvas-lab/canvas-lab-model";
import { isContextFrameId } from "@/lib/context-region";
import { safeStorageName, storageObjectKey } from "@/lib/upload-payload";

/** Everything Storage accepts in an object key. */
const SAFE = /^[a-zA-Z0-9/._-]+$/;

describe("F1 defect 1: the storage key is cleaned, the title is not", () => {
  it("accepts the file that did not come in", () => {
    const name = "[Proposal] CureFirst & Artemis Connection.docx";
    const key = storageObjectKey("11111111-1111-1111-1111-111111111111", "22222222-2222-2222-2222-222222222222", name);
    expect(key).toMatch(SAFE);
    expect(key.endsWith(".docx")).toBe(true);
    expect(key).toContain("22222222-2222-2222-2222-222222222222");
  });

  it("clears every character Storage refuses", () => {
    for (const name of [
      "[a].pdf",
      "a & b.pdf",
      "a b c.pdf",
      "hash#one.pdf",
      "what?.pdf",
      "100%.pdf",
      "Ünïcode日本語.pdf",
      "no-extension",
      "...",
    ]) {
      expect(safeStorageName(name)).toMatch(/^[a-zA-Z0-9._-]+$/);
    }
  });

  it("keeps the extension so the format is still read", () => {
    expect(safeStorageName("[Proposal] Deck.pptx").endsWith(".pptx")).toBe(true);
    expect(safeStorageName("Ünïcode.pdf").endsWith(".pdf")).toBe(true);
    expect(safeStorageName("[]")).toBe("file");
  });

  it("the capture path builds its key through the builder and names the reason", () => {
    const source = readFileSync("src/components/work/use-capture-files.ts", "utf8");
    expect(source).toContain("storageObjectKey(userId, crypto.randomUUID(), file.name)");
    expect(source).not.toContain("${userId}/${crypto.randomUUID()}-${file.name}");
    expect(source).toContain("title: file.name");
    expect(source).toContain("failures.push");
    const dialog = readFileSync("src/components/engagements/NewEngagementDialog.tsx", "utf8");
    expect(dialog).toContain("captureWithResult");
  });
});

describe("F1 defect 2: a region keeps its durable row", () => {
  function board(key: string) {
    return {
      id: "board-1",
      version: 1,
      canEditStructure: true,
      frames: [{ id: "frame-uuid", key, kind: "context", label: "Context", taskId: null, x: -22, y: -66, w: 536, h: 220, ord: 0, version: 2 }],
      nodes: [],
      links: [],
    } as never;
  }

  it("a reloaded context region is still the context region", () => {
    const merged = applyDurableBoard({ frames: [], nodes: [] }, board("context"));
    const frame = merged.frames[0];
    expect(frame).toBeDefined();
    expect(isContextFrameId(frame!.id)).toBe(true);
    expect(frame!.durableId).toBe("frame-uuid");
    expect(frame!.durableVersion).toBe(2);
  });

  it("never hands the record a size it would refuse", () => {
    const rect = { x: 0, y: 0, width: 100, height: 40 };
    const out = containFrameMembers(rect, "context", [
      { id: "n1", kind: "work", frame: "context", x: 10, y: 10, width: 20, height: 20 } as never,
    ]);
    expect(out.width).toBeGreaterThanOrEqual(FRAME_MIN_WIDTH);
    expect(out.height).toBeGreaterThanOrEqual(FRAME_MIN_HEIGHT);
  });

  it("the board says why a change was refused and flushes on the way out", () => {
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain("Could not save your last change. {lab.saveState.message}");
    expect(page).toContain('window.addEventListener("pagehide", flush)');
    expect(page).toContain('document.addEventListener("visibilitychange", onVisibility)');
  });
});

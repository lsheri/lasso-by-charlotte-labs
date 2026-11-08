import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  isWorkboardAskReadableKind,
  isWorkboardDecorationKind,
  isWorkboardMediaKind,
  validWorkboardNodeGeometry,
  type WorkboardNodeInput,
} from "@/lib/canvas-lab-shared";
import { validateLinkNodeKinds, validNodeInput, validNodeUpdate } from "@/lib/canvas-lab.server";
import { BOARD_VIDEO_COPY, BOARD_VIDEO_MAX_BYTES, buildImageNodeInput, isBoardVideoFile } from "@/components/canvas-lab/board-image";
import { resizeLabRect } from "@/components/canvas-lab/canvas-lab-model";

const body = JSON.stringify({ path: "u1/clip-Screen_Recording.mov", naturalWidth: 1280, naturalHeight: 720 });
const video = (overrides: Partial<WorkboardNodeInput> = {}): WorkboardNodeInput => ({
  clientKey: "video:1", frameKey: null, kind: "video", body, x: 0, y: 0, w: 420, h: 260, ...overrides,
});
const file = (name: string, type: string) => new File([new Uint8Array([1])], name, { type });

describe("VID-1 a video is a media card that is never read", () => {
  it("is media and a decoration, so Ask, links, context and the marquee leave it alone", () => {
    expect(isWorkboardMediaKind("video")).toBe(true);
    expect(isWorkboardMediaKind("image")).toBe(true);
    expect(isWorkboardMediaKind("sticky")).toBe(false);
    expect(isWorkboardDecorationKind("video")).toBe(true);
    expect(isWorkboardAskReadableKind("video")).toBe(false);
    expect(validateLinkNodeKinds(["video", "work_item"])).toBe("A video cannot be connected.");
  });

  it("carries only its file and rectangle", () => {
    expect(validNodeInput(video())).toBeNull();
    expect(validNodeInput(video({ workItemId: "w1" }))).toBe("A video cannot reference work or a decision.");
    expect(validNodeInput(video({ title: "x" }))).toBe("A video can only carry its file and rectangle.");
    expect(validNodeInput(video({ body: "not json" }))).toBe("Check the video file.");
    expect(validNodeUpdate("video", { body: body })).toBe("A video can only carry its file and rectangle.");
    expect(validNodeUpdate("video", { x: 10, y: 10, w: 200, h: 130 })).toBeNull();
  });

  it("uses the image size range and keeps its shape on resize", () => {
    expect(validWorkboardNodeGeometry({ kind: "video", w: 8, h: 8 })).toBe(true);
    expect(validWorkboardNodeGeometry({ kind: "video", w: 4001 })).toBe(false);
    const out = resizeLabRect({ x: 0, y: 0, width: 400, height: 250 }, "se", { x: 100, y: 0 }, false, "video");
    expect(out.width / out.height).toBeCloseTo(400 / 250, 1);
  });

  it("builds a video node input with the same body as an image", () => {
    const input = buildImageNodeInput({ kind: "video", clientKey: "video:1", body: { path: "u1/a.mov", naturalWidth: 1280, naturalHeight: 720 }, x: 0, y: 0, w: 420, h: 260 });
    expect(input.kind).toBe("video");
    expect(validNodeInput(input)).toBeNull();
    expect(buildImageNodeInput({ clientKey: "image:1", body: { path: "u1/a.png", naturalWidth: 10, naturalHeight: 10 }, x: 0, y: 0, w: 10, h: 10 }).kind).toBe("image");
  });

  it("recognises playable video files only", () => {
    expect(isBoardVideoFile(file("a.mov", "video/quicktime"))).toBe(true);
    expect(isBoardVideoFile(file("a.mp4", "video/mp4"))).toBe(true);
    expect(isBoardVideoFile(file("a.webm", "video/webm"))).toBe(true);
    expect(isBoardVideoFile(file("a.avi", "video/x-msvideo"))).toBe(false);
    expect(isBoardVideoFile(file("a.png", "image/png"))).toBe(false);
    expect(BOARD_VIDEO_MAX_BYTES).toBe(50 * 1024 * 1024);
    expect(BOARD_VIDEO_COPY.tooBig("clip.mov")).not.toMatch(/—/);
  });
});

describe("VID-1 wiring", () => {
  const drop = readFileSync("src/components/canvas-lab/board-file-drop.tsx", "utf8");
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");

  it("a dropped or pasted video never goes down the capture path", () => {
    expect(drop).toMatch(/const videos = paintVideo \? files\.filter\(isBoardVideoFile\) : \[\];/);
    expect(drop).toMatch(/const documents = files\.filter\(\(file\) => !images\.includes\(file\) && !videos\.includes\(file\)\);/);
    expect(drop.indexOf("file.size > BOARD_VIDEO_MAX_BYTES")).toBeLessThan(drop.indexOf("await dropVideo(file"));
  });

  it("the board never asks for a description of a video", () => {
    expect(page).toMatch(/if \(kind === "image"\) requestImageDescription\(saved\.id\);/);
    expect(page).toMatch(/paintVideo: \(preview, at\) => paintImageOnBoard\(preview, at, "video"\)/);
  });

  it("a video's file is deleted like an image's, only after the card is archived", () => {
    expect(page).toMatch(/if \(node\.kind === "image" \|\| node\.kind === "video"\) \{\s*\/\/ The file goes in the same action\./);
  });

  it("Ask receives image ids only, never videos", () => {
    expect(page).toMatch(/boardContextImageIds=\{contextNodes\.flatMap\(\(node\) => node\.kind === "image" && node\.durableId/);
  });

  it("a video card is drawn without context selection or connection anchors", () => {
    const line = page.split("\n").find((entry) => entry.includes('node.kind === "video").map((node) => <LabImage'));
    expect(line).toBeDefined();
    expect(line).not.toMatch(/onContextSelect|onAnchorPointerDown/);
  });

  it("the migration adds the kind and stops create history copying description columns", () => {
    const sql = readFileSync("supabase/migrations/20261108150000_vid1_video_cards_and_clean_create_history.sql", "utf8");
    expect(sql).toMatch(/'sticky','image','video'\]\)\)/);
    expect(sql).toMatch(/to_jsonb\(new\) - array\['image_text', 'image_text_status', 'image_text_at'\]/);
    expect(sql).toMatch(/security definer\s+set search_path = public/);
  });
});

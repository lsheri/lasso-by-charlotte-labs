// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn(async (_path: string, _file: File) => ({ error: null as null | { message: string } }));
const remove = vi.fn(async (_paths: string[]) => ({ error: null }));
const createSignedUrl = vi.fn(async (_path: string, _s: number) => ({ data: null as null | { signedUrl: string }, error: { message: "nope" } as null | { message: string } }));
const captureWithResult = vi.fn(async (files: File[], _o?: unknown) => ({ ids: files.map((_, i) => `w${i}`), failures: [] }));
const logEvent = vi.fn();
const toastFn = vi.fn();

vi.mock("sonner", () => ({ toast: Object.assign((m: string) => toastFn(m), { error: (m: string) => toastFn(m) }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(async () => ({})) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));
vi.mock("@/lib/item-text.functions", () => ({ getItemTextPane: {} }));
vi.mock("@/lib/workboard-artifact-preview.functions", () => ({ getWorkboardArtifactPreview: {} }));
vi.mock("@/components/work/use-capture-files", () => ({ useCaptureFiles: () => ({ captureWithResult }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: () => ({ upload, remove, createSignedUrl }) },
  },
}));

import { useBoardFileDrop } from "@/components/canvas-lab/board-file-drop";
import { BOARD_IMAGE_COPY, LabImage, buildImageNodeInput, removeBoardImageObject } from "@/components/canvas-lab/board-image";
import { fitWorkboardImageSize } from "@/lib/canvas-lab-shared";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

const place = vi.fn();
const placeImage = vi.fn(async () => true);
function Harness() {
  const drop = useBoardFileDrop({ enabled: true, toBoard: (x, y) => ({ x, y }), place, placeImage, readSize: async () => ({ width: 1600, height: 900 }) });
  return <div data-testid="shell" {...drop.handlers} />;
}
const png = () => new File(["p"], "shot.png", { type: "image/png" });
const pdf = () => new File(["d"], "deck.pdf", { type: "application/pdf" });
const drop = (list: File[]) => fireEvent.drop(screen.getByTestId("shell"), { clientX: 10, clientY: 20, dataTransfer: { types: ["Files"], files: list } });

describe("DD1-f board image drop", () => {
  afterEach(cleanup);
  beforeEach(() => { [upload, remove, createSignedUrl, captureWithResult, logEvent, toastFn, place, placeImage].forEach((f) => f.mockClear()); });

  it("1. a png skips the capture path and fires no workitem.captured", async () => {
    render(<Harness />);
    drop([png()]);
    await waitFor(() => expect(placeImage).toHaveBeenCalledTimes(1));
    expect(captureWithResult).not.toHaveBeenCalled();
    expect(logEvent.mock.calls.some((c) => c[0] === "workitem.captured")).toBe(false);
    expect(upload.mock.calls[0]?.[0]).toMatch(/^u1\/[0-9a-f-]+-shot\.png$/);
    expect(placeImage.mock.calls[0]).toEqual([expect.objectContaining({ naturalWidth: 1600, naturalHeight: 900 }), { x: 10, y: 20 }]);
  });
  it("2. a pdf still goes through capture exactly once", async () => {
    render(<Harness />);
    drop([pdf()]);
    await waitFor(() => expect(place).toHaveBeenCalled());
    expect(captureWithResult).toHaveBeenCalledTimes(1);
    expect(captureWithResult.mock.calls[0]?.[1]).toEqual({ channel: "drop" });
    expect(placeImage).not.toHaveBeenCalled();
  });
  it("3. a png and a pdf do both, each once", async () => {
    render(<Harness />);
    const [image, doc] = [png(), pdf()];
    drop([image, doc]);
    await waitFor(() => expect(placeImage).toHaveBeenCalledTimes(1));
    expect(captureWithResult).toHaveBeenCalledTimes(1);
    expect(captureWithResult.mock.calls[0]?.[0]).toEqual([doc]);
  });
  it("4. the node is an image with no work item and no decision", () => {
    const input = buildImageNodeInput({ clientKey: "image:1", body: { path: "u1/a-shot.png", naturalWidth: 1600, naturalHeight: 900 }, x: 1, y: 2, w: 420, h: 236 });
    expect(input.kind).toBe("image");
    expect(input.workItemId).toBeNull();
    expect(input.decisionId).toBeNull();
    expect(JSON.parse(input.body ?? "")).toEqual({ path: "u1/a-shot.png", naturalWidth: 1600, naturalHeight: 900 });
  });
  it("5. a large image keeps its aspect ratio with a 420 longest edge", () => {
    expect(fitWorkboardImageSize(1600, 900)).toEqual({ width: 420, height: 236 });
    expect(fitWorkboardImageSize(1170, 2532)).toEqual({ width: 194, height: 420 });
  });
  it("6. a small image is never scaled up", () => {
    expect(fitWorkboardImageSize(300, 200)).toEqual({ width: 300, height: 200 });
  });
  it("7. deleting an image node removes its storage object", async () => {
    await removeBoardImageObject("u1/a-shot.png");
    expect(remove).toHaveBeenCalledWith(["u1/a-shot.png"]);
    const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
    expect(page).toContain("if (node.imagePath) void removeBoardImageObject(node.imagePath);");
  });
  it("8. a failed signed URL shows the quiet line and no toast", async () => {
    const node = { id: "image:1", kind: "image", title: "Image", summary: "", typeLabel: "image", ownership: "yours", imagePath: "u1/a-shot.png", x: 0, y: 0, width: 200, height: 100 } as LabNode;
    render(<LabImage node={node} selected={false} layoutEditable onSelect={() => {}} onDragStart={() => {}} onResizeStart={() => {}} onResizeKeyDown={() => {}} onResizeKeyUp={() => {}} onRemove={() => {}} />);
    await waitFor(() => expect(screen.getByText(BOARD_IMAGE_COPY.failed)).toBeTruthy());
    expect(BOARD_IMAGE_COPY.failed).toBe("This image could not be loaded.");
    expect(toastFn).not.toHaveBeenCalled();
  });
});

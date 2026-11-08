// @vitest-environment jsdom
import { useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let resolveUpload: (path: string | null) => void = () => {};
const uploadBoardImage = vi.fn(() => new Promise<string | null>((resolve) => { resolveUpload = resolve; }));
const removeBoardImageObject = vi.fn(async () => {});

vi.mock("sonner", () => ({ toast: Object.assign(() => {}, { error: () => {} }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn(async () => ({})) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: () => {} }));
vi.mock("@/components/work/use-capture-files", () => ({ useCaptureFiles: () => ({ captureWithResult: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: { message: "x" } }) }) } } }));
vi.mock("@/components/canvas-lab/board-image", async (orig) => ({
  ...(await orig<typeof import("@/components/canvas-lab/board-image")>()),
  uploadBoardImage: () => uploadBoardImage(),
  removeBoardImageObject: () => removeBoardImageObject(),
}));

import { useBoardFileDrop, type PaintBoardImage } from "@/components/canvas-lab/board-file-drop";
import { LabImage } from "@/components/canvas-lab/board-image";
import type { LabNode } from "@/components/canvas-lab/canvas-lab-model";

const persist = vi.fn(async () => true);
function Harness() {
  const [cards, setCards] = useState<string[]>([]);
  const paintImage: PaintBoardImage = (preview) => {
    setCards((c) => [...c, preview.previewUrl]);
    return { persist, discard: () => setCards((c) => c.filter((u) => u !== preview.previewUrl)) };
  };
  const drop = useBoardFileDrop({ enabled: true, toBoard: (x, y) => ({ x, y }), place: vi.fn(), paintImage, readSize: async () => ({ width: 800, height: 600 }) });
  return <div data-testid="shell" {...drop.handlers}>{cards.map((u) => <span key={u} data-testid="painted" />)}</div>;
}
const dropPng = () => fireEvent.drop(screen.getByTestId("shell"), { clientX: 1, clientY: 1, dataTransfer: { types: ["Files"], files: [new File(["p"], "a.png", { type: "image/png" })] } });

describe("IMG-3c", () => {
  beforeEach(() => {
    [uploadBoardImage, removeBoardImageObject, persist].forEach((f) => f.mockClear());
    URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(cleanup);

  it("image anchors render as plain button.canvas-lab-anchor without shadcn classes", () => {
    const node = { id: "image:1", kind: "image", frame: null, title: "Image", summary: "", typeLabel: "image", ownership: "yours", imagePreviewUrl: "blob:x", x: 0, y: 0, width: 100, height: 80 } as LabNode;
    const { container } = render(<LabImage node={node} selected={false} layoutEditable onSelect={() => {}} onDragStart={() => {}} onResizeStart={() => {}} onResizeKeyDown={() => {}} onResizeKeyUp={() => {}} onRemove={() => {}} onAnchorPointerDown={() => {}} onAnchorActivate={() => {}} />);
    const anchors = container.querySelectorAll("button.canvas-lab-anchor");
    expect(anchors.length).toBe(4);
    anchors.forEach((a) => expect(a.getAttribute("class")).toBe("canvas-lab-anchor"));
    expect(container.querySelector("img")?.getAttribute("src")).toBe("blob:x");
  });

  it("dropImage paints before the upload resolves, then persists", async () => {
    render(<Harness />);
    dropPng();
    await waitFor(() => expect(screen.getAllByTestId("painted")).toHaveLength(1));
    expect(uploadBoardImage).toHaveBeenCalledTimes(1);
    expect(persist).not.toHaveBeenCalled();
    await act(async () => { resolveUpload("u1/b/x.png"); });
    await waitFor(() => expect(persist).toHaveBeenCalledWith("u1/b/x.png"));
    expect(screen.getAllByTestId("painted")).toHaveLength(1);
  });

  it("a failed upload removes the painted card", async () => {
    render(<Harness />);
    dropPng();
    await waitFor(() => expect(screen.getAllByTestId("painted")).toHaveLength(1));
    await act(async () => { resolveUpload(null); });
    await waitFor(() => expect(screen.queryAllByTestId("painted")).toHaveLength(0));
    expect(persist).not.toHaveBeenCalled();
  });
});

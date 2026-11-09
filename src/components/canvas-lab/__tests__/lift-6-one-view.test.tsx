// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/workboard-file-sign", () => ({ signWorkboardFileUrl: vi.fn(async () => "https://signed.example/pic.png") }));

import { LIFT_KINDS, LIFT_MORPH_MS, LIFT_RADIUS, liftFlip, liftKindOf } from "@/lib/lift-view";
import { LIFT_COPY, LIFT_KIND_ICON, LiftedWork } from "@/components/canvas-lab/LiftedWork";
import { LIFT_BODY_COPY, LiftedWorkBody, liftFilePreview } from "@/components/canvas-lab/LiftedWorkBody";
import { LiftedImageBody } from "@/components/canvas-lab/LiftedImageBody";
import { NO_PREVIEW_COPY } from "@/design/reference/NoPreview";
import type { WorkboardFilePreview } from "@/lib/workboard-card-preview.shared";
import type { WorkItemRow } from "@/lib/work-types";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const file = (over: Partial<WorkboardFilePreview>): WorkboardFilePreview => ({
  workItemId: "w1",
  kind: "fallback",
  url: null,
  lines: [],
  slideTitle: null,
  versionCount: 1,
  ...over,
});

describe("LIFT-6 the morph is a transform, never a layout change", () => {
  it("puts the view's box exactly on the card's box", () => {
    expect(liftFlip({ left: 100, top: 50, width: 200, height: 150 }, { left: 300, top: 100, width: 800, height: 600 })).toBe(
      "translate(-200px, -50px) scale(0.25, 0.25)",
    );
  });
  it("is the identity when the boxes match, and never divides by zero", () => {
    const box = { left: 10, top: 20, width: 300, height: 200 };
    expect(liftFlip(box, box)).toBe("translate(0px, 0px) scale(1, 1)");
    expect(liftFlip(box, { left: 0, top: 0, width: 0, height: 0 })).toContain("scale(1, 1)");
  });
  it("starts on the card, lets go on the next frames, and keeps its own box the whole way", () => {
    vi.useFakeTimers();
    const origin = { left: 10, top: 20, width: 260, height: 220 };
    render(
      <LiftedWork title="Deck" kind="deck" origin={origin} onClose={() => undefined}>
        {() => <p>x</p>}
      </LiftedWork>,
    );
    const panel = screen.getByTestId("lift-panel");
    expect(panel.getAttribute("data-phase")).toBe("from");
    expect(panel.style.transform).toContain("scale(");
    const width = panel.style.width;
    act(() => {
      vi.advanceTimersByTime(LIFT_MORPH_MS);
    });
    expect(panel.getAttribute("data-phase")).toBe("open");
    expect(panel.style.transform).toBe("");
    expect(panel.style.width).toBe(width);
  });
  it("with no card to grow from it simply appears, and closes at once", () => {
    const onClose = vi.fn();
    render(
      <LiftedWork title="Deck" kind="deck" origin={null} onClose={onClose}>
        {() => <p>x</p>}
      </LiftedWork>,
    );
    expect(screen.getByTestId("lift-panel").getAttribute("data-phase")).toBe("open");
    fireEvent.click(screen.getByRole("button", { name: LIFT_COPY.compress }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("LIFT-6 one frame for every kind", () => {
  it("every kind has its icon, and only the icon changes", () => {
    for (const kind of LIFT_KINDS) expect(LIFT_KIND_ICON[kind]).toBeTruthy();
    expect(liftKindOf("video")).toBe("video");
    expect(liftKindOf("ai_thread")).toBe("chat");
  });
  it("an image has no fuller view, so Expand is not drawn; back to the board still is", () => {
    render(
      <LiftedWork title="Whiteboard photo" kind="image" origin={null} onClose={() => undefined}>
        {() => <p>x</p>}
      </LiftedWork>,
    );
    expect(screen.queryByRole("button", { name: LIFT_COPY.expand })).toBeNull();
    expect(screen.getByRole("button", { name: LIFT_COPY.compress })).toBeTruthy();
    expect(screen.getByTestId("lift-kind")).toBeTruthy();
  });
  it("slightly rounded corners, one stage behind the work, and the content fades in after the box", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(LIFT_RADIUS).toBe(12);
    expect(css).toContain("border-radius: 12px; background: var(--nb-paper);");
    expect(css).toContain("transform-origin: 0 0; transition-property: transform;");
    expect(css).not.toContain("transition-property: left, top, width, height");
    expect(css).toContain('.lift-panel[data-phase="from"] > .lift-head, .lift-panel[data-phase="from"] > .lift-body { opacity: 0; transition: none; }');
    expect(css).toContain(".lift-body { position: relative; flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; background: var(--surface-sunk); }");
    // The document's dark grey desk becomes the same stage every other kind sits on.
    expect(css).toContain(".lift-real { margin: 0 auto; --neutral-60: var(--surface-sunk);");
  });
});

describe("LIFT-6 what a piece captured from a chat shows", () => {
  const item = { id: "w1", type: "sheet", title: "cheese-tracker.xlsx", content_fidelity: "reference" } as unknown as WorkItemRow;
  it("rows taken from a sheet draw as the sheet the card draws", () => {
    render(<LiftedWorkBody item={item} filePreview={file({ kind: "text", lines: ["Brie | soft", "Comté | hard"] })} bodyWidth={760} />);
    expect(screen.getByTestId("lift-real")).toBeTruthy();
    expect(screen.getByText("Comté | hard")).toBeTruthy();
  });
  it("text the card cannot draw shows as a page on the stage", () => {
    const doc = { id: "w2", type: "other", title: "notes.txt", content_fidelity: "reference" } as unknown as WorkItemRow;
    render(<LiftedWorkBody item={doc} filePreview={file({ kind: "text", lines: ["First line"] })} bodyWidth={760} />);
    const shown = screen.queryByTestId("lift-file") ?? screen.getByTestId("lift-real");
    expect(shown).toBeTruthy();
    expect(screen.getByText("First line")).toBeTruthy();
  });
  it("slides taken from a deck show with their page controls", () => {
    expect(liftFilePreview(file({ kind: "slide", lines: ["Org structure"], slideTitle: "Cure First" }))).toBeTruthy();
  });
  it("empty text or slides are not a preview", () => {
    expect(liftFilePreview(file({ kind: "text", lines: ["  "] }))).toBeUndefined();
    expect(liftFilePreview(file({ kind: "slide", lines: [], pages: [] }))).toBeUndefined();
  });
  it("a file with no preview says what the card says, and that it still counts as context", () => {
    render(<LiftedWorkBody item={item} filePreview={file({ kind: "fallback", reason: "not_previewable" })} bodyWidth={760} />);
    expect(screen.getByText(NO_PREVIEW_COPY.not_previewable)).toBeTruthy();
    expect(screen.getByText(LIFT_BODY_COPY.context)).toBeTruthy();
  });
  it("nothing at all still says so plainly", () => {
    render(<LiftedWorkBody item={item} bodyWidth={760} />);
    expect(screen.getByText(LIFT_BODY_COPY.nothing)).toBeTruthy();
  });
});

describe("LIFT-6 images and videos", () => {
  it("shows the local copy at once, then the signed link, fitted inside the view", async () => {
    render(<LiftedImageBody node={{ kind: "image", imagePath: "org/board/pic.png", imagePreviewUrl: "blob:local" }} />);
    const img = screen.getByTestId("lift-image").querySelector("img");
    expect(img?.getAttribute("src")).toBe("blob:local");
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("lift-image").querySelector("img")?.getAttribute("src")).toBe("https://signed.example/pic.png");
  });
  it("a video plays in the view with its controls", async () => {
    render(<LiftedImageBody node={{ kind: "video", imagePath: "org/board/clip.mp4" }} />);
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("lift-image").querySelector("video")?.hasAttribute("controls")).toBe(true);
  });
});

describe("LIFT-6 on the board (wiring pinned in source)", () => {
  const page = readFileSync("src/pages/CanvasLabPage.tsx", "utf8");
  const image = readFileSync("src/components/canvas-lab/board-image.tsx", "utf8");
  it("images and videos lift behind the same flag, through the same view", () => {
    expect(page.match(/onLift=\{liftV1 \? \(origin\) => liftPicture\(node, origin\) : undefined\}/g)?.length).toBe(2);
    expect(page).toContain("<LiftedImageBody node={liftedPicture} />");
    expect(page).toContain('kind={liftedPicture.kind === "video" ? "video" : "image"}');
  });
  it("every lifted card names its kind, so the frame's icon follows the work", () => {
    expect(page).toContain("kind={liftKindOf(liftedItem.type)}");
  });
  it("lifting a picture writes nothing to the board", () => {
    const fn = page.slice(page.indexOf("function liftPicture"), page.indexOf("function liftPicture") + 400);
    expect(fn).not.toMatch(/persistNodePatch|setNodes|record\(/);
  });
  it("an image lifts on a clean double-click, never after a drag, never from its buttons or its video controls", () => {
    expect(image).toContain('if (!onLift || (event.target as Element).closest("button,video")) return;');
    expect(image).toContain("Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 6) return;");
  });
});

describe("LIFT-6 QA fixes", () => {
  it("a board redraw in the middle of a close never cancels it", () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const origin = { left: 10, top: 20, width: 260, height: 220 };
    const view = (n: number) => (
      <LiftedWork title={`Deck ${n}`} kind="deck" origin={origin} onClose={() => onClose()} returnFocusTo={() => null}>
        {() => <p>x</p>}
      </LiftedWork>
    );
    const { rerender } = render(view(1));
    act(() => {
      vi.advanceTimersByTime(LIFT_MORPH_MS);
    });
    fireEvent.click(screen.getByRole("button", { name: LIFT_COPY.compress }));
    rerender(view(2));
    act(() => {
      vi.advanceTimersByTime(LIFT_MORPH_MS);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it("a dead local copy waits for the signed link instead of saying it failed", async () => {
    render(<LiftedImageBody node={{ kind: "image", imagePath: "org/board/pic.png", imagePreviewUrl: "blob:revoked" }} />);
    const img = screen.getByTestId("lift-image").querySelector("img") as HTMLImageElement;
    fireEvent.error(img);
    expect(screen.queryByTestId("lift-image-missing")).toBeNull();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByTestId("lift-image").querySelector("img")?.getAttribute("src")).toBe("https://signed.example/pic.png");
  });
  it("chat bubbles keep their own colour inside the view", () => {
    const css = readFileSync("src/styles.css", "utf8");
    expect(css).not.toContain("--surface-sunk-2: var(--surface-sunk)");
  });
  it("no move or resize while it shrinks home", () => {
    const src = readFileSync("src/components/canvas-lab/LiftedWork.tsx", "utf8");
    expect(src).toContain('if (event.button !== 0 || phase !== "open") return;');
  });
});

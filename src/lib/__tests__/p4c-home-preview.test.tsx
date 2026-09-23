// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HomeBoardPreview } from "@/components/home/HomeEngagementGrid";
import {
  HOME_PREVIEW_FRAME_CAP,
  HOME_PREVIEW_NODE_CAP,
  previewBounds,
  previewTransform,
  type PreviewRect,
} from "@/lib/home-board-preview";

const query = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain["select"] = vi.fn(() => chain);
  chain["in"] = vi.fn(() => chain);
  chain["is"] = vi.fn(() => chain);
  chain["eq"] = vi.fn(() => chain);
  chain["order"] = vi.fn(() => chain);
  chain["limit"] = vi.fn(() => chain);
  chain["then"] = vi.fn((resolve: (result: { data: unknown[]; error: null }) => unknown) => resolve({ data: [], error: null }));
  return { from: vi.fn(() => chain), chain };
});

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));
vi.mock("@/lib/client-telemetry", () => ({ emitClientEvent: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: query.from } }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function projectedSize(rect: PreviewRect, viewport: { width: number; height: number }) {
  const transform = previewTransform([rect], viewport);
  return { width: rect.w * transform.scale, height: rect.h * transform.scale, scale: transform.scale };
}

describe("Home preview geometry", () => {
  it("finds a lone node in a distant corner without treating the origin as content", () => {
    expect(previewBounds([{ x: 900, y: 700, w: 20, h: 10 }])).toEqual({ x: 900, y: 700, w: 20, h: 10 });
    const transform = previewTransform([{ x: 900, y: 700, w: 20, h: 10 }], { width: 200, height: 100 });
    expect(transform.scale).toBe(1);
    expect(900 * transform.scale + transform.offsetX).toBe(90);
    expect(700 * transform.scale + transform.offsetY).toBe(45);
  });

  it("preserves a wide board's aspect ratio", () => {
    const result = projectedSize({ x: 0, y: 0, w: 800, h: 200 }, { width: 200, height: 100 });
    expect(result.width / result.height).toBe(4);
    expect(result.width).toBeLessThanOrEqual(188);
  });

  it("preserves a tall board's aspect ratio", () => {
    const result = projectedSize({ x: 0, y: 0, w: 100, h: 600 }, { width: 200, height: 100 });
    expect(result.width / result.height).toBeCloseTo(1 / 6);
    expect(result.height).toBeLessThanOrEqual(88);
  });

  it("never scales a tiny board above one-to-one", () => {
    expect(previewTransform([{ x: 10, y: 10, w: 12, h: 8 }], { width: 200, height: 100 }).scale).toBe(1);
  });
});

describe("Home preview states", () => {
  it("distinguishes not-yet-loaded from empty while both render only paper", () => {
    const loading = render(<HomeBoardPreview state={{ status: "loading" }} />);
    expect(screen.getByTestId("home-board-preview").getAttribute("data-preview-state")).toBe("loading");
    expect(document.querySelectorAll("[data-preview-frame], [data-preview-node]")).toHaveLength(0);
    loading.unmount();

    render(<HomeBoardPreview state={{ status: "ready", board: { frames: [], nodes: [] } }} />);
    expect(screen.getByTestId("home-board-preview").getAttribute("data-preview-state")).toBe("empty");
    expect(document.querySelectorAll("[data-preview-frame], [data-preview-node]")).toHaveLength(0);
  });

  it("draws frames before nodes", () => {
    render(<HomeBoardPreview state={{ status: "ready", board: {
      frames: [{ x: 0, y: 0, w: 100, h: 80, fill: "blue-faded" }],
      nodes: [{ x: 10, y: 10, w: 20, h: 10 }],
    } }} />);
    const shapes = [...document.querySelectorAll("[data-preview-frame], [data-preview-node]")];
    expect(shapes.map((shape) => shape.getAttribute("data-preview-frame") ? "frame" : "node")).toEqual(["frame", "node"]);
  });
});

describe("the bounded preview read", () => {
  it("uses one query for many engagements with no board text columns", async () => {
    const { fetchEngagementBoardPreviews, HOME_PREVIEW_SELECT } = await import("@/hooks/use-engagement-board-previews");
    await fetchEngagementBoardPreviews(["e1", "e2", "e3"]);

    expect(query.from).toHaveBeenCalledTimes(1);
    expect(query.from).toHaveBeenCalledWith("workboards");
    expect(query.chain["in"]).toHaveBeenCalledWith("engagement_id", ["e1", "e2", "e3"]);
    expect(HOME_PREVIEW_SELECT).toBe("engagement_id,workboard_frames(x,y,w,h,fill),workboard_nodes(x,y,w,h)");
    expect(HOME_PREVIEW_SELECT).not.toMatch(/title|body|label/);
    expect(query.chain["limit"]).toHaveBeenCalledWith(HOME_PREVIEW_FRAME_CAP, { referencedTable: "workboard_frames" });
    expect(query.chain["limit"]).toHaveBeenCalledWith(HOME_PREVIEW_NODE_CAP, { referencedTable: "workboard_nodes" });
  });
});

describe("P4c mutation proof", () => {
  it("fails if a tiny board is enlarged and passes when scale is capped at one", () => {
    const tiny = { x: 0, y: 0, w: 10, h: 10 };
    const mutatedScale = Math.min(188 / tiny.w, 88 / tiny.h);
    expect(mutatedScale).toBeGreaterThan(1);
    expect(previewTransform([tiny], { width: 200, height: 100 }).scale).toBe(1);
  });
});
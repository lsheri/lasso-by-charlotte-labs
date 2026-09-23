import type { RegionFill } from "@/lib/board-region";

export const HOME_PREVIEW_WIDTH = 416;
export const HOME_PREVIEW_HEIGHT = 132;
export const HOME_PREVIEW_INSET = 6;
export const HOME_PREVIEW_FRAME_CAP = 12;
export const HOME_PREVIEW_NODE_CAP = 60;

export type PreviewRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type HomePreviewFrame = PreviewRect & {
  fill: RegionFill | string | null;
};

export type HomePreviewBoard = {
  frames: readonly HomePreviewFrame[];
  nodes: readonly PreviewRect[];
};

export type HomePreviewState =
  | { status: "loading" }
  | { status: "ready"; board: HomePreviewBoard };

export type PreviewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
  bounds: PreviewRect | null;
};

export function previewBounds(rects: readonly PreviewRect[]): PreviewRect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((rect) => rect.x));
  const top = Math.min(...rects.map((rect) => rect.y));
  const right = Math.max(...rects.map((rect) => rect.x + Math.max(0, rect.w)));
  const bottom = Math.max(...rects.map((rect) => rect.y + Math.max(0, rect.h)));
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

export function previewTransform(
  rects: readonly PreviewRect[],
  viewport = { width: HOME_PREVIEW_WIDTH, height: HOME_PREVIEW_HEIGHT },
  inset = HOME_PREVIEW_INSET,
): PreviewTransform {
  const bounds = previewBounds(rects);
  if (!bounds) return { scale: 1, offsetX: 0, offsetY: 0, bounds: null };
  const availableWidth = Math.max(0, viewport.width - inset * 2);
  const availableHeight = Math.max(0, viewport.height - inset * 2);
  const widthScale = bounds.w > 0 ? availableWidth / bounds.w : 1;
  const heightScale = bounds.h > 0 ? availableHeight / bounds.h : 1;
  const scale = Math.min(1, widthScale, heightScale);
  return {
    scale,
    offsetX: (viewport.width - bounds.w * scale) / 2 - bounds.x * scale,
    offsetY: (viewport.height - bounds.h * scale) / 2 - bounds.y * scale,
    bounds,
  };
}

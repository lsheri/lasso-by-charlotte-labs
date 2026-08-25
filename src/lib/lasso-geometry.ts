/**
 * The geometry behind the lasso: what a freehand path actually encloses on a
 * rendered page. Pure functions so the hit test is testable without a browser,
 * and so the snippet a person circles is decided by the page's own text runs
 * rather than by anything the model is told later.
 */

import { MAX_SNIPPET_CHARS } from "@/lib/span-provenance-shared";

export type TextRun = {
  text: string;
  /** Page pixel coordinates of the run's box, top left origin. */
  x: number;
  y: number;
  w: number;
  h: number;
};

export type Point = { x: number; y: number };
export type BBox = { x: number; y: number; w: number; h: number };

/** Ray casting. A point exactly on an edge is not worth arguing about. */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    const straddles = a.y > point.y !== b.y > point.y;
    if (!straddles) continue;
    const xAt = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-9) + a.x;
    if (point.x < xAt) inside = !inside;
  }
  return inside;
}

/**
 * Reading order: down the page first, then across. The one comparator both the
 * lasso and the joined page text use, so a circled snippet is always findable
 * in the text it came from.
 */
export function readingOrder(a: TextRun, b: TextRun): number {
  return Math.abs(a.y - b.y) > Math.max(a.h, b.h) * 0.6 ? a.y - b.y : a.x - b.x;
}

/** The runs in reading order, whatever order they arrived in. */
export function sortReadingOrder(runs: TextRun[]): TextRun[] {
  return runs.slice().sort(readingOrder);
}

/** The runs whose centre the ink actually went around, in reading order. */
export function enclosedRuns(runs: TextRun[], polygon: Point[]): TextRun[] {
  return sortReadingOrder(
    runs.filter((run) => pointInPolygon({ x: run.x + run.w / 2, y: run.y + run.h / 2 }, polygon)),
  );
}


/** Reading order text for a set of runs, capped the way a span is capped. */
export function snippetFromRuns(runs: TextRun[]): string {
  return runs
    .map((run) => run.text.trim())
    .filter((text) => text.length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SNIPPET_CHARS);
}

/** The rectangle the ink shrink wraps to. Null when nothing was enclosed. */
export function unionBBox(runs: TextRun[]): BBox | null {
  if (runs.length === 0) return null;
  const x = Math.min(...runs.map((r) => r.x));
  const y = Math.min(...runs.map((r) => r.y));
  const right = Math.max(...runs.map((r) => r.x + r.w));
  const bottom = Math.max(...runs.map((r) => r.y + r.h));
  return { x, y, w: right - x, h: bottom - y };
}

/** Page pixels to 0..1 page coordinates, which is what a locator stores. */
export function normalizeBBox(box: BBox, width: number, height: number): BBox {
  const w = width || 1;
  const h = height || 1;
  return { x: box.x / w, y: box.y / h, w: box.w / w, h: box.h / h };
}

/**
 * A page is a slide only when the record says so: a Drive presentation link, or
 * an extraction that genuinely carried slide headings. Otherwise it is a page,
 * and nothing pretends otherwise.
 */
export function pageUnitFor(input: {
  webViewLink?: string | null;
  text?: string | null;
}): "slide" | "page" {
  if ((input.webViewLink ?? "").includes("/presentation/")) return "slide";
  if (/^##\s+Slide\s+\d+\s*$/m.test(input.text ?? "")) return "slide";
  return "page";
}

export function pageLabel(unit: "slide" | "page", index: number): string {
  return unit === "slide" ? `Slide ${index}` : `Page ${index}`;
}

/** 0..1 page coordinates back to page pixels at the rendered size. */
export function denormalizeBBox(box: BBox, width: number, height: number): BBox {
  return { x: box.x * width, y: box.y * height, w: box.w * width, h: box.h * height };
}

/** A bbox is usable only when it is a real, on-page rectangle. */
export function isUsableBBox(box: BBox | null | undefined): box is BBox {
  if (!box) return false;
  const values = [box.x, box.y, box.w, box.h];
  if (values.some((v) => typeof v !== "number" || !Number.isFinite(v))) return false;
  return box.w > 0 && box.h > 0 && box.x >= 0 && box.y >= 0 && box.x <= 1 && box.y <= 1;
}

/**
 * Pass 105: the ink itself is the mark. A drawn loop is kept with the stitch in
 * 0..1 page coordinates so it can be redrawn exactly where it was drawn, and it
 * is decimated first: eighty points is more than enough to read as a hand-drawn
 * circle and small enough to sit in a locator.
 */
export const MAX_INK_POINTS = 80;

/** Fewer points than this is a tap or a flick, not a loop around a fact. */
export const MIN_LASSO_POINTS = 8;

/** A loop smaller than this share of the page is not a deliberate circle. */
export const MIN_LASSO_AREA_RATIO = 0.01;

/** Even stride sampling, always keeping the first and last point. */
export function decimatePath(points: Point[], max = MAX_INK_POINTS): Point[] {
  if (points.length <= max) return points.slice();
  const stride = (points.length - 1) / (max - 1);
  const out: Point[] = [];
  for (let i = 0; i < max; i += 1) out.push(points[Math.round(i * stride)] as Point);
  return out;
}

/** Page pixels to the stored ink: clamped 0..1 pairs, at most eighty of them. */
export function normalizeInk(
  points: Point[],
  width: number,
  height: number,
): [number, number][] {
  const w = width || 1;
  const h = height || 1;
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return decimatePath(points).map((point) => [clamp(point.x / w), clamp(point.y / h)]);
}

/** Stored ink back to page pixels at the size this page is rendered at. */
export function denormalizeInk(
  ink: readonly (readonly [number, number])[],
  width: number,
  height: number,
): Point[] {
  return ink.map(([x, y]) => ({ x: x * width, y: y * height }));
}

/** Ink is usable only when it is a real run of finite on-page pairs. */
export function isUsableInk(ink: unknown): ink is [number, number][] {
  if (!Array.isArray(ink) || ink.length < 3) return false;
  return ink.every(
    (pair) =>
      Array.isArray(pair) &&
      pair.length === 2 &&
      pair.every((value) => typeof value === "number" && Number.isFinite(value)),
  );
}

/** The shoelace area of a drawn loop, in whatever units it was drawn in. */
export function polygonArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const a = points[i] as Point;
    const b = points[j] as Point;
    sum += b.x * a.y - a.x * b.y;
  }
  return Math.abs(sum) / 2;
}

/**
 * A loop that never really became one. Answered before anything is read, so a
 * stray flick costs nothing and gets an honest nudge instead of silence.
 */
export function isDegenerateLasso(points: Point[], width: number, height: number): boolean {
  if (points.length < MIN_LASSO_POINTS) return true;
  const page = (width || 1) * (height || 1);
  return polygonArea(points) / page < MIN_LASSO_AREA_RATIO;
}

/**
 * The drawn loop as one gently smoothed path. Midpoints between samples become
 * the on-curve points, so the stroke keeps the hand that drew it without the
 * jitter a pointer stream carries.
 */
export function inkPathD(points: Point[]): string {
  if (points.length === 0) return "";
  const first = points[0] as Point;
  if (points.length < 3) {
    return `M ${first.x} ${first.y} ${points
      .slice(1)
      .map((p) => `L ${p.x} ${p.y}`)
      .join(" ")}`;
  }
  let d = `M ${first.x} ${first.y}`;
  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i] as Point;
    const next = points[i + 1] as Point;
    d += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`;
  }
  const last = points[points.length - 1] as Point;
  return `${d} L ${last.x} ${last.y}`;
}

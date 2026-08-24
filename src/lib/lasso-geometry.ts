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

/** The runs whose centre the ink actually went around, in reading order. */
export function enclosedRuns(runs: TextRun[], polygon: Point[]): TextRun[] {
  return runs
    .filter((run) => pointInPolygon({ x: run.x + run.w / 2, y: run.y + run.h / 2 }, polygon))
    .slice()
    .sort((a, b) => (Math.abs(a.y - b.y) > Math.max(a.h, b.h) * 0.6 ? a.y - b.y : a.x - b.x));
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

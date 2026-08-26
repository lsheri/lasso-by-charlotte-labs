import { emitClientEvent } from "./client-telemetry";

/**
 * Hard document loads only. In-app route transitions are already covered by
 * engagement.load in perf-timing.ts; the same navigation must never produce
 * both.
 *
 * CONTENT RULE: identical discipline to perf-timing.ts. The builder below owns
 * the dims object and knows exactly six keys. A path never travels, because a
 * path can carry a client name or a UUID; only a route class does.
 *
 * DELIBERATE DEPARTURE FROM HOUSE STYLE: milliseconds are exact, not bucketed.
 * Short retention operational data, never joined to the longitudinal record.
 */

export const ROUTE_CLASSES = Object.freeze([
  "landing",
  "auth",
  "overview",
  "engagement",
  "work",
  "firm",
  "reflect",
  "other",
] as const);

export type RouteClass = (typeof ROUTE_CLASSES)[number];

const ROUTE_CLASS_SET: ReadonlySet<string> = new Set(ROUTE_CLASSES);

/** Pathname to a class. Segments after the first are ignored on purpose. */
export function classifyRoute(pathname: string | null | undefined): RouteClass {
  const path = typeof pathname === "string" ? pathname : "";
  const first = path.split("?")[0]!.split("#")[0]!.split("/").filter(Boolean)[0]?.toLowerCase();
  if (!first) return "landing";
  switch (first) {
    case "auth":
    case "join":
    case "onboarding":
    case "no-access":
      return "auth";
    case "overview":
      return "overview";
    case "engagements":
      return "engagement";
    case "work":
      return "work";
    case "firm":
      return "firm";
    case "reflect":
      return "reflect";
    default:
      return "other";
  }
}

const MAX_MS = 120_000;

function metric(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const raw = Number(value);
  if (!Number.isFinite(raw)) return null;
  return Math.min(MAX_MS, Math.max(0, Math.round(raw)));
}

export type PageLoadInput = {
  route_class: RouteClass;
  ttfb_ms?: number | null | undefined;
  fcp_ms?: number | null | undefined;
  lcp_ms?: number | null | undefined;
  dom_ready_ms?: number | null | undefined;
  load_ms?: number | null | undefined;
};

/**
 * The only shape a perf.pageload row can take. Extra keys are dropped, values
 * are rounded and clamped, and a metric the browser did not report is omitted
 * rather than zero-filled: a missing LCP is not a zero millisecond LCP.
 */
export function buildPageLoadDims(input: PageLoadInput): Record<string, string | number> | null {
  if (!ROUTE_CLASS_SET.has(input.route_class as string)) return null;
  const dims: Record<string, string | number> = { route_class: input.route_class };
  for (const key of ["ttfb_ms", "fcp_ms", "lcp_ms", "dom_ready_ms", "load_ms"] as const) {
    const value = metric(input[key]);
    if (value !== null) dims[key] = value;
  }
  return dims;
}

export function emitPageLoad(input: PageLoadInput): boolean {
  const dims = buildPageLoadDims(input);
  if (!dims) return false;
  emitClientEvent("perf.pageload", dims);
  return true;
}

/** One row per document load, however many times the wiring runs. */
let started = false;

/** Test seam. */
export function resetPageLoadGuard(): void {
  started = false;
}

/** Longest we will wait for LCP to settle before reporting what we have. */
export const PAGELOAD_SETTLE_CAP_MS = 10_000;

export function initPageLoadTiming(): void {
  if (started) return;
  started = true;
  if (typeof window === "undefined" || typeof performance === "undefined") return;

  let lcp: number | null = null;
  let observer: PerformanceObserver | null = null;

  try {
    if (typeof PerformanceObserver === "function") {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) lcp = entry.startTime;
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    }
  } catch {
    observer = null;
  }

  let sent = false;
  const finish = () => {
    if (sent) return;
    sent = true;
    try {
      observer?.disconnect();
    } catch {
      /* observer teardown is best effort */
    }
    const nav = performance.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    const paints = performance.getEntriesByType?.("paint") ?? [];
    const fcp = paints.find((p) => p.name === "first-contentful-paint")?.startTime ?? null;

    emitPageLoad({
      route_class: classifyRoute(window.location?.pathname),
      ttfb_ms: nav ? nav.responseStart : null,
      fcp_ms: fcp,
      lcp_ms: lcp,
      dom_ready_ms: nav && nav.domContentLoadedEventEnd > 0 ? nav.domContentLoadedEventEnd : null,
      load_ms: nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : null,
    });
  };

  const cap = window.setTimeout(finish, PAGELOAD_SETTLE_CAP_MS);
  const settle = () => {
    window.clearTimeout(cap);
    finish();
  };

  // LCP is final at the first user interaction or when the page is hidden;
  // otherwise we take the cap. Either way it is one row.
  window.addEventListener("pagehide", settle, { once: true });
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") settle();
  });
}

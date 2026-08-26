import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("../telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/telemetry.functions", () => ({ recordAnonymousEventFn: vi.fn(async () => ({})) }));
vi.mock("../telemetry.functions", () => ({ recordAnonymousEventFn: vi.fn(async () => ({})) }));

import { logEvent } from "../telemetry";
import { recordAnonymousEventFn } from "../telemetry.functions";
import { resetClientTelemetry, setClientTelemetryOrg } from "../client-telemetry";
import {
  buildPageLoadDims,
  classifyRoute,
  emitPageLoad,
  initPageLoadTiming,
  resetPageLoadGuard,
} from "../pageload-timing";
import {
  ERROR_EMIT_CAP,
  buildErrorDims,
  errorFingerprint,
  reportClientError,
  resetErrorSignal,
} from "../error-signal";
import { clearOpenStarts, markOpenStart, takeOpenStart } from "../perf-timing";

const emitted = logEvent as unknown as ReturnType<typeof vi.fn>;
const anon = recordAnonymousEventFn as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  emitted.mockClear();
  anon.mockClear();
  resetClientTelemetry();
  resetErrorSignal();
  resetPageLoadGuard();
  clearOpenStarts();
  setClientTelemetryOrg("org-1");
});

describe("route classification", () => {
  it("never lets a UUID reach the emit", () => {
    const uuid = "9f1c2b7e-3a44-4d0c-91b2-6f0d1e2a3b4c";
    expect(classifyRoute(`/engagements/${uuid}`)).toBe("engagement");
    emitPageLoad({ route_class: classifyRoute(`/engagements/${uuid}`), ttfb_ms: 12 });
    const dims = JSON.stringify(emitted.mock.calls[0]?.[2]);
    expect(dims).not.toContain(uuid);
    expect(dims).not.toContain("engagements/");
  });

  it("maps the known surfaces", () => {
    expect(classifyRoute("/")).toBe("landing");
    expect(classifyRoute("/auth")).toBe("auth");
    expect(classifyRoute("/overview")).toBe("overview");
    expect(classifyRoute("/work")).toBe("work");
    expect(classifyRoute("/firm")).toBe("firm");
    expect(classifyRoute("/reflect")).toBe("reflect");
    expect(classifyRoute("/settings")).toBe("other");
  });
});

describe("perf.pageload dims builder", () => {
  it("drops extra keys, rounds and clamps", () => {
    const dims = buildPageLoadDims({
      route_class: "work",
      ttfb_ms: 10.6,
      lcp_ms: 999_999,
      // @ts-expect-error attack case: a caller trying to attach content
      title: "Acme restructuring deck",
    });
    expect(dims).toEqual({ route_class: "work", ttfb_ms: 11, lcp_ms: 120_000 });
  });

  it("omits missing metrics rather than zero filling them", () => {
    const dims = buildPageLoadDims({ route_class: "landing", fcp_ms: 100, lcp_ms: null });
    expect(Object.keys(dims!).sort()).toEqual(["fcp_ms", "route_class"]);
  });

  it("refuses an unknown route class", () => {
    // @ts-expect-error deliberate
    expect(buildPageLoadDims({ route_class: "/engagements/abc" })).toBeNull();
  });
});

describe("one emit per document load", () => {
  it("guards repeat initialisation", () => {
    vi.useFakeTimers();
    initPageLoadTiming();
    initPageLoadTiming();
    initPageLoadTiming();
    vi.advanceTimersByTime(20_000);
    vi.useRealTimers();
    const loads = emitted.mock.calls.filter((c) => c[0] === "perf.pageload");
    expect(loads.length).toBeLessThanOrEqual(1);
  });
});

describe("client.error", () => {
  it("carries the constructor name only, never the message", () => {
    const error = new TypeError("cannot read property of Acme Corp brief");
    error.stack = "TypeError: x\n    at fn (https://app.test/assets/peek-abc.js:42:9?v=1)";
    const dims = buildErrorDims(error, "window", "/engagements/123");
    expect(dims).toEqual({
      route_class: "engagement",
      error_name: "TypeError",
      fingerprint: expect.stringMatching(/^[0-9a-f]{8}$/),
      source: "window",
    });
    expect(JSON.stringify(dims)).not.toContain("Acme");
  });

  it("fingerprints stably for the same name and frame", () => {
    const stack = "Error: x\n    at f (https://app.test/assets/a.js:10:2)";
    expect(errorFingerprint("TypeError", stack)).toBe(errorFingerprint("TypeError", stack));
    expect(errorFingerprint("TypeError", stack)).not.toBe(errorFingerprint("RangeError", stack));
  });

  it("drops message and stack keys an attacker attaches", () => {
    const rogue = Object.assign(new Error("secret client name"), {
      message: "secret client name",
      stack: "Error: secret client name\n    at f (https://app.test/a.js:1:1)",
      component: "PeekPanel",
    });
    reportClientError(rogue, "boundary");
    const dims = emitted.mock.calls.find((c) => c[0] === "client.error")?.[2] as Record<
      string,
      unknown
    >;
    expect(Object.keys(dims).sort()).toEqual([
      "error_name",
      "fingerprint",
      "route_class",
      "source",
    ]);
    expect(JSON.stringify(dims)).not.toContain("secret");
    expect(JSON.stringify(dims)).not.toContain("PeekPanel");
  });

  it("caps emits at ten per minute", () => {
    for (let i = 0; i < 25; i += 1) reportClientError(new Error("boom"), "window");
    expect(emitted.mock.calls.filter((c) => c[0] === "client.error")).toHaveLength(ERROR_EMIT_CAP);
  });

  it("uses the anonymous path before a session exists", () => {
    setClientTelemetryOrg(null);
    reportClientError(new Error("boom"), "promise");
    expect(emitted).not.toHaveBeenCalled();
    expect(anon).toHaveBeenCalledTimes(1);
    expect(anon.mock.calls[0]?.[0].data.event_type).toBe("client.error");
  });
});

describe("peek.open is gesture anchored", () => {
  it("consumes a start exactly once and stays silent without one", () => {
    expect(takeOpenStart("peek.open")).toBeNull();
    markOpenStart("peek.open");
    expect(typeof takeOpenStart("peek.open")).toBe("number");
    expect(takeOpenStart("peek.open")).toBeNull();
  });

  it("no longer anchors the panel at mount", () => {
    const source = readFileSync("src/components/peek/PeekPanel.tsx", "utf8");
    expect(source).not.toContain("usePerfMountTimer");
    expect(source).toContain('usePerfOpenFinish("peek.open"');
  });
});

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full);
  }
  return out;
}

describe("no browser analytics SDK outside its one file", () => {
  it("keeps posthog confined to the server telemetry files and the SDK wrapper", () => {
    const offenders = walk("src").filter((file) => {
      if (/telemetry.*\.server\.ts$/.test(file)) return false;
      if (file.endsWith("posthog-client.ts")) return false;
      if (file.includes("__tests__")) return false;
      const text = readFileSync(file, "utf8");
      // Prose about PostHog is fine; an SDK import or a browser capture is not.
      return /posthog-js|window\.posthog|posthog\.(capture|init)/i.test(text);
    });
    expect(offenders).toEqual([]);
  });
});

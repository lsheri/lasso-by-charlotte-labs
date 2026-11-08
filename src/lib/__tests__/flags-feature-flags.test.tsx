// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const ph = vi.hoisted(() => ({
  answer: undefined as boolean | undefined,
  listeners: [] as Array<() => void>,
}));
vi.mock("@/lib/posthog-client", () => ({
  readFeatureFlag: () => ph.answer,
  onFeatureFlagsLoaded: (cb: () => void) => {
    ph.listeners.push(cb);
    return () => { ph.listeners = ph.listeners.filter((l) => l !== cb); };
  },
}));

import { FEATURE_FLAGS, flagEnabled } from "@/lib/feature-flags";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { resolveAskDraft } from "@/lib/ask-draft";
import { sha256Hex } from "@/lib/data-consent-shared";

const PROD = "lasso.charlotte-labs.com";
const PREVIEW = "id-preview--57cd51ce-f7b4-4cd0-a7d0-761453b5935b.lovable.app";
const mkStore = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }; };

beforeEach(() => { ph.answer = undefined; ph.listeners = []; });

describe("FLAGS catalogue", () => {
  it("every flag has a boolean code default", () => {
    for (const [name, spec] of Object.entries(FEATURE_FLAGS)) {
      expect(typeof spec.default, name).toBe("boolean");
    }
  });
  it("uses the code default when PostHog has no answer, and PostHog's answer when it has one", () => {
    expect(flagEnabled("ask-floating")).toBe(true);
    ph.answer = false;
    expect(flagEnabled("ask-floating")).toBe(false);
    ph.answer = true;
    expect(flagEnabled("ask-floating")).toBe(true);
  });
});

describe("FLAGS ask-floating kill switch", () => {
  it("on by default: production gets the floating panel", () => {
    expect(resolveAskDraft(PROD, "", mkStore())).toBe("b");
  });
  it("off in PostHog: production gets the docked panel, and ?ask=on cannot override it", () => {
    ph.answer = false;
    expect(resolveAskDraft(PROD, "", mkStore())).toBeNull();
    expect(resolveAskDraft(PROD, "?ask=on", mkStore())).toBeNull();
  });
  it("never touches preview hosts, where the drafts are the experiment", () => {
    ph.answer = false;
    expect(resolveAskDraft(PREVIEW, "", mkStore())).toBe("b");
    expect(resolveAskDraft(PREVIEW, "?ask=a", mkStore())).toBe("a");
  });
});

describe("FLAGS useFeatureFlag", () => {
  it("renders the default first, then follows PostHog when flags load", () => {
    const { result } = renderHook(() => useFeatureFlag("ask-floating"));
    expect(result.current).toBe(true);
    ph.answer = false;
    act(() => { for (const l of ph.listeners) l(); });
    expect(result.current).toBe(false);
  });
});

describe("FLAGS boundaries", () => {
  it("the workspace group key is plain SHA-256 of the org id, the same hash the server sends", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    const server = readFileSync("src/lib/telemetry.server.ts", "utf8");
    expect(server).toMatch(/const tenantHash = await sha256Hex\(input\.orgId\)/);
    expect(server).toMatch(/\$groups: \{ org: tenantHash \}/);
  });
  it("posthog-js is still imported by posthog-client.ts only", () => {
    for (const file of ["src/lib/feature-flags.ts", "src/hooks/use-feature-flag.ts", "src/lib/ask-draft.ts", "src/components/layout/AppShell.tsx"]) {
      expect(readFileSync(file, "utf8"), file).not.toMatch(/from ["']posthog-js["']/);
    }
  });
});

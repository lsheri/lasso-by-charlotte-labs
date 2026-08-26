import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const identify = vi.fn();
const reset = vi.fn();
const capture = vi.fn();

vi.mock("posthog-js", () => ({
  default: { init, identify, reset, capture },
}));

import {
  POSTHOG_CONFIG,
  POSTHOG_TOKEN,
  identifyPostHog,
  initPostHog,
  resetPostHog,
  resetPostHogGuard,
} from "../posthog-client";

beforeEach(() => {
  init.mockClear();
  identify.mockClear();
  reset.mockClear();
  resetPostHogGuard();
});

describe("SDK config is a trust guarantee", () => {
  it("pins every masking key and every capture switch", () => {
    initPostHog();
    expect(init).toHaveBeenCalledTimes(1);
    const [token, config] = init.mock.calls[0] as [string, Record<string, unknown>];
    expect(token).toBe(POSTHOG_TOKEN);
    expect(config.api_host).toBe("https://us.i.posthog.com");
    expect(config.autocapture).toBe(true);
    expect(config.capture_pageview).toBe(false);
    expect(config.capture_pageleave).toBe(false);
    expect(config.capture_performance).toBe(false);
    expect(config.capture_exceptions).toBe(true);
    expect(config.capture_dead_clicks).toBe(false);
    expect(config.person_profiles).toBe("identified_only");
    expect(config.session_recording).toEqual({
      maskAllInputs: true,
      maskTextSelector: "*",
      blockSelector: "img, svg, canvas, video, embed, object, iframe, picture",
    });
    expect(POSTHOG_CONFIG.session_recording.maskTextSelector).toBe("*");
  });

  it("initialises once only", () => {
    initPostHog();
    initPostHog();
    initPostHog();
    expect(init).toHaveBeenCalledTimes(1);
  });
});

describe("identity carries no person properties", () => {
  it("passes the id and nothing else", () => {
    identifyPostHog("profile-1");
    expect(identify).toHaveBeenCalledWith("profile-1");
    expect(identify.mock.calls[0]).toHaveLength(1);
  });

  it("refuses an object payload at the type level", () => {
    // @ts-expect-error the wrapper accepts ONLY a string id
    identifyPostHog({ id: "p", email: "a@b.c", display_name: "A" });
  });

  it("resets rather than identifying when there is no profile", () => {
    identifyPostHog(null);
    expect(identify).not.toHaveBeenCalled();
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("resets on sign out", () => {
    resetPostHog();
    expect(reset).toHaveBeenCalledTimes(1);
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

describe("SDK confinement", () => {
  it("only src/lib/posthog-client.ts imports posthog-js", () => {
    const offenders = walk("src").filter((file) => {
      if (file.includes("__tests__")) return false;
      if (file.endsWith("posthog-client.ts")) return false;
      return /from ["']posthog-js["']|require\(["']posthog-js["']\)/.test(
        readFileSync(file, "utf8"),
      );
    });
    expect(offenders).toEqual([]);
  });

  it("never captures a custom event through the SDK", () => {
    const offenders = walk("src").filter((file) => {
      if (file.includes("__tests__")) return false;
      return readFileSync(file, "utf8").includes("posthog.capture(");
    });
    expect(offenders).toEqual([]);
  });
});

describe("the disclosure line", () => {
  it("appears verbatim on the Trust & data page", () => {
    const source = readFileSync("src/routes/trust.tsx", "utf8").replace(/\s+/g, " ");
    expect(source).toContain(
      "To improve the product we measure how the interface is used: clicks, load times, " +
        "and masked interaction replays. Everything readable is masked in your browser " +
        "before anything is sent. Your documents, conversations, and prompts never leave " +
        "your device through analytics.",
    );
  });
});

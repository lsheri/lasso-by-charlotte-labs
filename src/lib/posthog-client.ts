import posthog from "posthog-js";

import { isProductionHost } from "@/lib/app-host";

/**
 * The ONLY file in src that may touch posthog-js.
 *
 * The SDK exists for three things the first-party pipeline cannot do: masked
 * session replay, PostHog's error tracking UI ($exception), and click
 * autocapture. Every custom event goes through logEvent, forever.
 *
 * The masking config is a trust guarantee, not a tuning knob.
 */

export const POSTHOG_TOKEN = "phc_mb9PLASteZ87YA6P34n4Mb9Hp9rW3oXXRQvq6qXiy6mw";

export const POSTHOG_CONFIG = {
  api_host: "https://us.i.posthog.com",
  autocapture: true,
  capture_pageview: false, // first-party perf.pageload + landing.viewed own this
  capture_pageleave: false,
  capture_performance: false, // first-party owns timings; never double-count
  capture_exceptions: true, // PostHog error tracking UI
  capture_dead_clicks: false,
  person_profiles: "identified_only",
  session_recording: {
    maskAllInputs: true,
    maskTextSelector: "*", // deny-by-default: NO readable text ever leaves the browser
    blockSelector: "img, svg, canvas, video, embed, object, iframe, picture",
  },
} as const;

let started = false;

/** Test seam. */
export function resetPostHogGuard(): void {
  started = false;
}

export function initPostHog(): void {
  if (started) return;
  if (typeof window === "undefined") return;
  started = true;
  try {
    posthog.init(POSTHOG_TOKEN, {
      ...POSTHOG_CONFIG,
      // Session replay is a production-only surface. The allowed hosts live in
      // src/lib/app-host.ts, so both hosts work through the transition.
      disable_session_recording: !isProductionHost(window.location.hostname),
    } as Parameters<typeof posthog.init>[1]);
  } catch {
    /* telemetry must never break the app */
  }
}

/**
 * Accepts ONLY an id. No person properties, ever: no email, no display name,
 * no role. Passing null resets the identity.
 */
export function identifyPostHog(profileId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (!profileId) {
      posthog.reset();
      return;
    }
    posthog.identify(profileId);
  } catch {
    /* telemetry must never break the app */
  }
}

/**
 * The logged-out marketing page is not recorded. Anonymous visitors to a
 * public page get no replay; every authenticated surface is untouched.
 */
export function stopSessionReplay(): void {
  if (typeof window === "undefined") return;
  try {
    posthog.stopSessionRecording();
  } catch {
    /* telemetry must never break the app */
  }
}

/** Restore replay when leaving the public page. */
export function startSessionReplay(): void {
  if (typeof window === "undefined") return;
  try {
    if (!isProductionHost(window.location.hostname)) return;
    posthog.startSessionRecording();
  } catch {
    /* telemetry must never break the app */
  }
}

/** Sign-out: drop the identity and start a fresh anonymous session. */
export function resetPostHog(): void {
  if (typeof window === "undefined") return;
  try {
    posthog.reset();
  } catch {
    /* telemetry must never break the app */
  }
}

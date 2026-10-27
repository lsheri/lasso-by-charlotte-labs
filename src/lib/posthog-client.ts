import posthog, { type BeforeSendFn } from "posthog-js";

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

/** Redact link credentials wherever a URL is embedded, without losing its context. */
export function scrubShareTokens(url: string): string {
  return url
    .replace(/\/(memo|shared-board|share)\/[^/?#&\s"'<>]+/g, "/$1/:token")
    .replace(/(%2f(?:memo|shared-board|share)%2f)(?:(?!%2f|%3f|%23|%26)[^/?#&\s"'<>])+/gi, "$1:token");
}

function scrubProperty(value: unknown): unknown {
  if (typeof value === "string") return scrubShareTokens(value);
  if (Array.isArray(value)) return value.map(scrubProperty);
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, scrubProperty(entry)]));
  }
  return value;
}

const scrubShareEvent: BeforeSendFn = (event) => {
  if (!event) return null;
  return {
    ...event,
    properties: scrubProperty(event.properties) as typeof event.properties,
    ...(event.$set ? { $set: scrubProperty(event.$set) as typeof event.$set } : {}),
    ...(event.$set_once ? { $set_once: scrubProperty(event.$set_once) as typeof event.$set_once } : {}),
  };
};

export const POSTHOG_CONFIG = {
  api_host: "https://us.i.posthog.com",
  before_send: scrubShareEvent,
  // No cookie option: cookie_domain is not a posthog-js option. The shared
  // visitor id across the umbrella domain and its subdomains comes from
  // cross_subdomain_cookie, which defaults to true and scopes the cookie to
  // the registrable domain.
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
 * Founder-facing pilot identity and optional person properties. Never work content.
 * Passing null resets the identity.
 */
export function identifyPostHog(profileId: string | null, properties?: Partial<Record<"email" | "name" | "org_id" | "org_type" | "register" | "signup_source", string>>): void {
  if (typeof window === "undefined") return;
  try {
    if (!profileId) {
      posthog.reset();
      return;
    }
    if (properties === undefined) posthog.identify(profileId);
    else posthog.identify(profileId, properties);
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

/**
 * Unit D6: the browser's own anonymous id, read only so the server path can
 * hash it. Undefined during SSR, before init, or when blocked.
 */
export function getPostHogDistinctId(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const id = posthog.get_distinct_id();
    return typeof id === "string" && id.length > 0 ? id : undefined;
  } catch {
    return undefined;
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

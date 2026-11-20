import posthog, { type BeforeSendFn } from "posthog-js";

import { isProductionHost } from "@/lib/app-host";
import { environmentFromHost } from "@/lib/environment-shared";

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

/** The events PostHog's script makes by itself from a click, a burst of clicks or a copy. */
export const CLICK_EVENTS: readonly string[] = ["$autocapture", "$rageclick", "$dead_click", "$copy_autocapture"];

/** Click properties that carry what was on the screen: the words, where a link went, what was copied. */
const CLICK_TEXT_KEYS = ["$el_text", "$external_click_url", "$selected_content"] as const;

const TAG = /^[a-z][a-z0-9-]*/;
const POSITION = /:(?:[^"]|"(?:[^"\\]|\\.)*")*?nth-child="(\d+)"(?:[^"]|"(?:[^"\\]|\\.)*")*?nth-of-type="(\d+)"/;

/** One element of the chain, cut where a new element starts and never inside a quoted value. */
function chainSegments(chain: string): string[] {
  const segments: string[] = [];
  let start = 0;
  let quoted = false;
  for (let index = 0; index < chain.length; index += 1) {
    const char = chain[index];
    if (char === "\\") index += 1;
    else if (char === '"') quoted = !quoted;
    else if (char === ";" && !quoted) {
      segments.push(chain.slice(start, index));
      start = index + 1;
    }
  }
  segments.push(chain.slice(start));
  return segments;
}

/**
 * 20 Nov 2026 (Liam, Q-59): the element chain of a click, rebuilt from nothing but each element's kind and its place
 * among its siblings. Text, link addresses, ids, titles, labels, values and class names are never copied across: an
 * element is written out again from the two things we keep, so anything this does not recognise is left out.
 */
export function bareElementsChain(chain: unknown): string {
  if (typeof chain !== "string" || chain.length === 0 || chain.length > 100_000) return "";
  const kept: string[] = [];
  for (const segment of chainSegments(chain)) {
    const tag = TAG.exec(segment)?.[0];
    if (!tag) continue;
    const place = POSITION.exec(segment.slice(tag.length));
    kept.push(place ? `${tag}:nth-child="${place[1]}"nth-of-type="${place[2]}"` : tag);
  }
  return kept.join(";");
}

function bareElements(elements: unknown): Array<Record<string, string | number>> {
  if (!Array.isArray(elements)) return [];
  const kept: Array<Record<string, string | number>> = [];
  for (const element of elements) {
    const record = element && typeof element === "object" ? (element as Record<string, unknown>) : {};
    const tag = typeof record["tag_name"] === "string" ? TAG.exec(record["tag_name"].toLowerCase())?.[0] : undefined;
    if (!tag) continue;
    const place = (key: string) => (typeof record[key] === "number" && Number.isFinite(record[key]) ? { [key]: record[key] as number } : {});
    kept.push({ tag_name: tag, ...place("nth_child"), ...place("nth_of_type") });
  }
  return kept;
}

/**
 * A click event with everything that was on the screen taken out. What is left says that something of a given kind
 * was clicked, where it sat in the page, and on which page. Nothing a person typed, read or named.
 */
export function stripClickText(properties: Record<string, unknown>): Record<string, unknown> {
  const kept: Record<string, unknown> = { ...properties };
  for (const key of CLICK_TEXT_KEYS) delete kept[key];
  if ("$elements" in kept) kept["$elements"] = bareElements(kept["$elements"]);
  if ("$elements_chain" in kept) kept["$elements_chain"] = bareElementsChain(kept["$elements_chain"]);
  return kept;
}

/** Local development: this machine's own address. Nothing made here is sent to the live project. */
export function isLocalHost(hostname: unknown): boolean {
  return typeof hostname === "string" && environmentFromHost(hostname) === "local";
}

const scrubShareEvent: BeforeSendFn = (event) => {
  if (!event) return null;
  if (typeof window !== "undefined" && isLocalHost(window.location.hostname)) return null;
  const properties = scrubProperty(event.properties) as typeof event.properties;
  return {
    ...event,
    properties: CLICK_EVENTS.includes(event.event) ? (stripClickText(properties) as typeof event.properties) : properties,
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
  // 20 Nov 2026 (Liam, Q-59): a click is kept, what was clicked on is not. The script is told to read no text and no
  // attributes, and before_send above rebuilds the element chain as well, because the script still adds a link's
  // address after masking. Both must hold: the second is the one our tests can prove.
  mask_all_text: true,
  mask_all_element_attributes: true,
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

/**
 * FLAGS (7 Nov): declare the person's workspace to PostHog as the same
 * sha256(org id) the server mirror already sends in $groups, never a name.
 * Lets replays and browser events be read per workspace. null does nothing;
 * sign-out clears it through posthog.reset().
 */
export function groupWorkspace(orgHash: string | null): void {
  if (typeof window === "undefined" || !orgHash) return;
  try {
    posthog.group("org", orgHash);
  } catch {
    /* telemetry must never break the app */
  }
}

/**
 * FLAGS: PostHog's answer for one flag, or undefined when it has no answer yet
 * (before flags load, SSR, blocked by an ad blocker). Callers never use this
 * directly; they go through flagEnabled in feature-flags.ts, which supplies the
 * code default. posthog-js keeps the last answer in its own storage, so from
 * the second page load on the answer is there at first paint.
 */
export function readFeatureFlag(key: string): boolean | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const value = posthog.isFeatureEnabled(key);
    return typeof value === "boolean" ? value : undefined;
  } catch {
    return undefined;
  }
}

/** FLAGS: run cb whenever PostHog (re)loads flags. Returns an unsubscribe. */
export function onFeatureFlagsLoaded(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  try {
    const off = posthog.onFeatureFlags(() => cb());
    return typeof off === "function" ? off : () => {};
  } catch {
    return () => {};
  }
}

import { readFeatureFlag } from "./posthog-client";

/**
 * FLAGS (7 Nov, Liam): feature flags are managed in PostHog. This file is the
 * catalogue: a flag name that is not listed here cannot be read.
 *
 * Rules, one per line, so a new flag is checked against all of them:
 * 1. Every flag has a code default. The app must work, and look right, with
 *    PostHog unreachable (ad blockers stop it entirely) and before flags load.
 * 2. A browser flag changes what someone sees, never what data they can reach.
 *    Access and permissions are checked on the server, always.
 * 3. Flags aggregate by person. To target one workspace, add a release
 *    condition on the person property org_id (set by identifyPostHog).
 *    A group-aggregated flag answers false until the workspace is declared,
 *    which would override the code default, so do not create one without
 *    reading this first.
 * 4. The key in PostHog matches the key here exactly.
 * 5. Retire a flag by deleting it here and in PostHog in the same change.
 * 6. FLAGS-1 (10 Nov, Liam): every user sees every feature. A flag is added only for a future need (a
 *    staged rollout, a kill switch), never to hold a finished feature back from people.
 */
export const FEATURE_FLAGS = {
  /**
   * The floating, draggable Ask panel on production hosts (GATE-LIFT, #22).
   * Default on. A kill switch: turn it off in PostHog and production returns to
   * the docked panel on the next page load. Preview hosts are not affected.
   */
  "ask-floating": { default: true },
} as const satisfies Record<string, { default: boolean }>;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/** PostHog's answer when it has one, otherwise the code default. */
export function flagEnabled(name: FeatureFlag): boolean {
  return readFeatureFlag(name) ?? FEATURE_FLAGS[name].default;
}

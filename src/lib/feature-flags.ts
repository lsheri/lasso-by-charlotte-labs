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
  /**
   * The firm brain (Liam, 16 Nov): every brain surface (Shown to client, Red pen, Partner read) stays hidden until
   * it is tested. Default off. On for a workspace the database marks (workspaceFlagsFor below), so the demo firm never
   * depends on PostHog loading. In PostHog: a person release condition on org_id = the QA workspace only, never a
   * group flag. Server functions and database functions check access themselves, so this only hides screens.
   * Retired in the same change that turns it on for everyone.
   */
  "company-brain": { default: false },
} as const satisfies Record<string, { default: boolean }>;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Flags the workspace itself switches on (19 Nov 2026, Liam signed in to the demo firm with PostHog blocked and saw no
 * firm brain at all). The mark is read from the workspace's own row in the database with the profile, so it does not
 * depend on an analytics script the browser may block, and it is there at first paint. For a marked workspace the
 * flag is on whatever PostHog says. Rule 2 still holds: this only shows screens; every server function checks access.
 *
 * company-brain is on for the seeded demo firm (settings.demo_firm, written by the seed) and for any workspace whose
 * settings carry firm_brain: true (how a pilot firm is switched on; that is a database write and needs Liam's yes).
 */
export { workspaceFlagsFor } from "./workspace-flags";

let workspaceOn: ReadonlySet<FeatureFlag> = new Set();
const workspaceListeners = new Set<() => void>();

/** The flags the active workspace switches on. Replaces the last set; an empty list on sign-out or a workspace switch. */
export function setWorkspaceFlags(names: readonly FeatureFlag[]): void {
  const next = new Set(names.filter((name) => name in FEATURE_FLAGS));
  if (next.size === workspaceOn.size && [...next].every((name) => workspaceOn.has(name))) return;
  workspaceOn = next;
  for (const listener of [...workspaceListeners]) listener();
}

/** Run cb whenever the workspace's flags change. Returns an unsubscribe. */
export function onWorkspaceFlags(cb: () => void): () => void {
  workspaceListeners.add(cb);
  return () => {
    workspaceListeners.delete(cb);
  };
}

/** On when the workspace switches it on; otherwise PostHog's answer when it has one, otherwise the code default. */
export function flagEnabled(name: FeatureFlag): boolean {
  if (workspaceOn.has(name)) return true;
  return readFeatureFlag(name) ?? FEATURE_FLAGS[name].default;
}

import { aliasSignupVisitorFn, recordAnonymousEventFn } from "./telemetry.functions";
import { logEvent } from "./telemetry";
import { getPostHogDistinctId } from "./posthog-client";
import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";

/**
 * One emit path for client-side operational signals (perf.pageload,
 * client.error) that must work before a session exists.
 *
 * Signed in: the canonical org-scoped path, same as every other event.
 * Signed out: the anonymous path landing.viewed already uses, with a random
 * per-page view id. No browser analytics SDK is involved and none should be
 * added for this.
 */

let orgId: string | null = null;
let viewId: string | null = null;

/** Set by the app shell once the active profile is known. */
export function setClientTelemetryOrg(next: string | null | undefined): void {
  orgId = next ?? null;
}

export function getClientTelemetryOrg(): string | null {
  return orgId;
}

/** Test seam. */
export function resetClientTelemetry(): void {
  orgId = null;
  viewId = null;
}

function pageViewId(): string {
  if (viewId) return viewId;
  const random =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  viewId = random;
  return random;
}

function visitorField(): { visitor_id?: string } {
  const id = getPostHogDistinctId();
  return id ? { visitor_id: id } : {};
}

/** Fire and forget. Never throws, never surfaces to the user. */
export function emitClientEvent(
  event: TelemetryEvent,
  dims: TelemetryDims,
  options?: { stableVisitor?: boolean },
): void {
  if (orgId) {
    logEvent(event, orgId, dims);
    return;
  }
  void recordAnonymousEventFn({
    data: {
      event_type: event,
      view_id: pageViewId(),
      dims,
      // Unit D6: only the public signup funnel opts in; everything else keeps
      // the unlinkable per-page id.
      ...(options?.stableVisitor ? visitorField() : {}),
    },
  }).catch(() => {
    /* telemetry must never surface to the user */
  });
}

let aliasedUserId: string | null = null;

/** Test seam. */
export function resetSignupAlias(): void {
  aliasedUserId = null;
}

/**
 * Unit D7: at sign-up success only. Sends the browser's visitor id once per
 * account so the server can alias the salted anonymous hash to the account.
 * Missing visitor id means no alias. Never throws.
 */
export function aliasSignupVisitor(userId: string): void {
  try {
    if (!userId || aliasedUserId === userId) return;
    const visitor = visitorField().visitor_id;
    if (!visitor) return;
    aliasedUserId = userId;
    void aliasSignupVisitorFn({ data: { user_id: userId, visitor_id: visitor } }).catch(() => {
      /* a failed alias loses a join, never an account */
    });
  } catch {
    /* a failed alias loses a join, never an account */
  }
}

import { recordAnonymousEventFn } from "./telemetry.functions";
import { logEvent } from "./telemetry";
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

/** Fire and forget. Never throws, never surfaces to the user. */
export function emitClientEvent(event: TelemetryEvent, dims: TelemetryDims): void {
  if (orgId) {
    logEvent(event, orgId, dims);
    return;
  }
  void recordAnonymousEventFn({
    data: { event_type: event, view_id: pageViewId(), dims },
  }).catch(() => {
    /* telemetry must never surface to the user */
  });
}

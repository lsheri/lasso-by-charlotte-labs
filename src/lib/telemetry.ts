import { recordEventFn } from "./telemetry.functions";
import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";

export { bucket } from "./telemetry-shared";
export type { CaptureChannel, TelemetryDims, TelemetryEvent } from "./telemetry-shared";

/**
 * Fire-and-forget. Never blocks the UI, never carries content or names.
 * The server writes the canonical row and mirrors a content-free copy.
 */
export function logEvent(eventType: TelemetryEvent, orgId: string, dims: TelemetryDims): void {
  void recordEventFn({ data: { event_type: eventType, org_id: orgId, dims } }).catch(() => {
    /* telemetry must never surface to the user */
  });
}

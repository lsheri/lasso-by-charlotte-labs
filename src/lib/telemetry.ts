import { consumeEntryDim } from "./onboarding-entry";
import { recordEventFn } from "./telemetry.functions";
import { nextClientSeq, sessionId } from "./telemetry-session";
import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";

export { bucket } from "./telemetry-shared";
export type { CaptureChannel, TelemetryDims, TelemetryEvent } from "./telemetry-shared";

/**
 * Fire-and-forget. Never blocks the UI, never carries content or names.
 * The server writes the canonical row and mirrors a content-free copy.
 */
export function logEvent(eventType: TelemetryEvent, orgId: string, dims: TelemetryDims): void {
  const entry = consumeEntryDim(eventType);
  const merged = entry ? { ...dims, ...entry } : dims;
  void (async () => {
    // The server only accepts signed-in events; skip the call when there is
    // no session so signed-out pages never raise an unauthorized error.
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    if (!data.session) return;
    await recordEventFn({
      data: {
        event_type: eventType,
        org_id: orgId,
        dims: merged,
        session_id: sessionId(),
        client_seq: nextClientSeq(),
      },
    });
  })().catch(() => {
    /* telemetry must never surface to the user */
  });
}

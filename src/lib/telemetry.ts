import { supabase } from "@/integrations/supabase/client";
import { sha256 } from "@/lib/parse-thread";

export type TelemetryEvent =
  | "workitem.captured"
  | "workitem.mapped"
  | "workitem.marked_private";

/** Fire-and-forget. Never blocks the UI, never carries content or names. */
export function logEvent(
  eventType: TelemetryEvent,
  orgId: string,
  dims: { type: string; source: string },
): void {
  void (async () => {
    try {
      const tenant_hash = await sha256(orgId);
      await supabase.from("events").insert({
        event_type: eventType,
        schema_version: "v1",
        tenant_hash,
        dims,
        payload: {},
      });
    } catch {
      /* telemetry must never surface to the user */
    }
  })();
}

import { supabase } from "@/integrations/supabase/client";
import { sha256 } from "@/lib/parse-thread";

export type TelemetryEvent =
  | "workitem.captured"
  | "workitem.mapped"
  | "workitem.marked_private"
  | "decision.drafted"
  | "decision.resolved"
  | "connector.enabled"
  | "connector.synced"
  | "import.completed"
  | "import.started"
  | "import.parsed"
  | "import.committed"
  | "import.abandoned";

/** 0 · 1-10 · 11-50 · 51-200 · 200+ — counts never leave as exact values. */
export function bucket(n: number): string {
  if (n <= 0) return "0";
  if (n <= 10) return "1-10";
  if (n <= 50) return "11-50";
  if (n <= 200) return "51-200";
  return "200+";
}

/** Fire-and-forget. Never blocks the UI, never carries content or names. */
export function logEvent(
  eventType: TelemetryEvent,
  orgId: string,
  dims: Record<string, string | number | boolean | Record<string, number>>,
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

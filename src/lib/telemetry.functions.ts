import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { TelemetryDims, TelemetryEvent } from "./telemetry-shared";

export const recordEventFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { event_type: TelemetryEvent; org_id: string; dims?: TelemetryDims }) => input,
  )
  .handler(async ({ data, context }) => {
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(context.supabase, {
      eventType: data.event_type,
      orgId: data.org_id,
      userId: context.userId,
      dims: data.dims ?? {},
    });
    return { ok: true };
  });

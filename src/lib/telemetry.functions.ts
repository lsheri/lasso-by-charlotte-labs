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

/**
 * Marketing pages are seen by people with no session at all, so this path has
 * no auth middleware. It accepts only content-free dims and a random view id.
 */
export const recordAnonymousEventFn = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { event_type: TelemetryEvent; view_id: string; dims?: TelemetryDims }) => input,
  )
  .handler(async ({ data }) => {
    const { recordAnonymousEvent } = await import("./telemetry.server");
    await recordAnonymousEvent(data.event_type, String(data.view_id).slice(0, 64), data.dims ?? {});
    return { ok: true };
  });

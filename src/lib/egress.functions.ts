import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EgressRunView = {
  sent: number;
  skipped: number;
  failed: number;
  content_sent: number;
  content_skipped: number;
  content_failed: number;
};

/** Manual sweep, admins only. Reads nothing new and changes no event. */
export const runEgressNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { profile_id?: string | undefined }) => input)
  .handler(async ({ data, context }): Promise<EgressRunView> => {
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile || profile.role !== "admin") throw new Error("Forbidden");
    const { runEgress } = await import("./egress.server");
    const events = await runEgress();
    const { runContentEgress } = await import("./content-egress.server");
    const content = await runContentEgress();
    return {
      ...events,
      content_sent: content.sent,
      content_skipped: content.skipped,
      content_failed: content.failed,
    };
  });

export type EgressSweepView =
  | { status: "skipped"; reason: "too-soon" | "already-running" }
  | {
      status: "ran";
      events: { sent: number; skipped: number; failed: number };
      samples: { sent: number; skipped: number; failed: number };
    };

/**
 * Pass 175b: any signed-in page may give the sweep an awaited home. It never
 * changes an event and never reports anything to the person.
 */
export const runEgressSweepFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<EgressSweepView> => {
    const { runGuardedSweepNow } = await import("./egress.server");
    const result = await runGuardedSweepNow();
    if (result.status === "skipped") return result;
    return {
      status: "ran",
      events: result.events,
      samples: {
        sent: result.samples.sent,
        skipped: result.samples.skipped,
        failed: result.samples.failed,
      },
    };
  });

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { FindingLabel } from "./telemetry-v2-shared";

/**
 * The human label on a finding: the scarce asset. The browser sends the preset,
 * the label and the exact number of claims it saw. It never sends an org id:
 * the gateway resolves identity from the authenticated session.
 */
export const labelFinding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      preset: string;
      label: FindingLabel;
      claims_rendered: number;
      run_id?: string | undefined;
      profile_id?: string | undefined;
    }) => {
      if (input.label !== "confirmed" && input.label !== "rejected") throw new Error("Bad label.");
      return input;
    },
  )
  .handler(async ({ data, context }) => {
    const { recordEventV2 } = await import("./telemetry-v2.server");
    await recordEventV2(context.supabase, context.userId, {
      eventName: "finding.labelled",
      props: {
        preset: data.preset.slice(0, 64),
        label: data.label,
        claims_rendered: Math.max(0, Math.round(data.claims_rendered)),
      },
      profileId: data.profile_id ?? null,
      email: (context.claims as { email?: string } | null | undefined)?.email ?? null,
    });
    await recordEventV2(context.supabase, context.userId, {
      eventName: data.label === "confirmed" ? "finding.confirmed" : "finding.rejected",
      props: { preset: data.preset.slice(0, 64) },
      profileId: data.profile_id ?? null,
      email: (context.claims as { email?: string } | null | undefined)?.email ?? null,
    });
    if (data.run_id) {
      const { labelAnalysisFinding } = await import("./facts.server");
      await labelAnalysisFinding({ analysisRunId: data.run_id, response: data.label });
    }
    return { ok: true };
  });

/**
 * The browser bridge. A client action that is part of the record of practice
 * (mapping, capture, a decision status change) emits through here. The gateway
 * still validates the name and every prop, and still resolves identity from the
 * authenticated session: this bridge widens nothing.
 */
export const emitV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      event_name: string;
      props: Record<string, string | number | boolean>;
      profile_id?: string | undefined;
      work_item_id?: string | undefined;
      engagement_id?: string | undefined;
      episode_id?: string | undefined;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { recordEventV2, isEventNameV2 } = await import("./telemetry-v2.server");
    if (!isEventNameV2(data.event_name)) {
      console.warn(`[telemetry-v2] bridge rejected unknown name: ${data.event_name}`);
      return { ok: false as const };
    }
    await recordEventV2(context.supabase, context.userId, {
      eventName: data.event_name,
      props: data.props,
      profileId: data.profile_id ?? null,
      workItemId: data.work_item_id ?? null,
      engagementId: data.engagement_id ?? null,
      episodeId: data.episode_id ?? null,
      email: (context.claims as { email?: string } | null | undefined)?.email ?? null,
    });
    return { ok: true as const };
  });

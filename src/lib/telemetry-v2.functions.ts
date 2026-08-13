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
    return { ok: true };
  });

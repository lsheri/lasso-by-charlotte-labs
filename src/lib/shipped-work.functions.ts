import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import type { ShippedCard } from "@/lib/shipped-work-shared";

type ShipInput = { work_item_id: string; engagement_id: string | null; profile_id?: string | null | undefined };
type UnshipInput = { work_item_id: string; profile_id?: string | null | undefined };

function validateShip(input: ShipInput): ShipInput {
  if (!input?.work_item_id) throw new Error("work_item_id is required");
  return {
    work_item_id: input.work_item_id,
    engagement_id: input.engagement_id ?? null,
    profile_id: input.profile_id ?? null,
  };
}

function validateUnship(input: UnshipInput): UnshipInput {
  if (!input?.work_item_id) throw new Error("work_item_id is required");
  return { work_item_id: input.work_item_id, profile_id: input.profile_id ?? null };
}

/** Owner-initiated, deliverables only. A re-ship replaces the card. */
export const shipWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateShip)
  .handler(async ({ data, context }) => {
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { shipWorkRow } = await import("./shipped-work.server");
    return shipWorkRow(context.supabase as never, supabaseAdmin as never, {
      workItemId: data.work_item_id,
      engagementId: data.engagement_id,
      profile: { id: profile.id, role: profile.role },
    });
  });

/** The shipper or the owner takes the card back. The work is untouched. */
export const unshipWork = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateUnship)
  .handler(async ({ data, context }) => {
    const profile = await resolveProfile(context.supabase, context.userId, data.profile_id);
    if (!profile || profile.role === "coach") throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { unshipWorkRow } = await import("./shipped-work.server");
    return unshipWorkRow(context.supabase as never, supabaseAdmin as never, {
      workItemId: data.work_item_id,
      profile: { id: profile.id, role: profile.role },
    });
  });

/** Plain caller-RLS read: the archive is whatever this viewer may see. */
export const listShippedWork = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ShippedCard[]> => {
    const { listShippedCards } = await import("./shipped-work.server");
    return listShippedCards(context.supabase as never);
  });

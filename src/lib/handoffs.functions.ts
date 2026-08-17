import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { HandoffBlock } from "@/lib/handoffs-shared";

type LoadInput = { run_id: string; profile_id?: string | undefined };
type ActInput = { run_id: string; item_id: string; profile_id?: string | undefined };
type BatchInput = { run_id: string; item_ids: string[]; profile_id?: string | undefined };

export type HandoffLoadResult = { block: HandoffBlock | null };
export type HandoffActResult = { block: HandoffBlock | null; duplicate: boolean };

/** The drafts on one run, owner only. A coach never receives a draft. */
export const loadHandoffs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: LoadInput) => {
    if (!input?.run_id) throw new Error("run_id is required");
    return input;
  })
  .handler(async ({ data, context }): Promise<HandoffLoadResult> => {
    const { supabase, userId } = context;
    const { resolveProfile } = await import("./profile-resolve");
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) throw new Response("Forbidden", { status: 403 });
    const { ownedRun } = await import("./handoffs.server");
    const run = await ownedRun(data.run_id, profile.id);
    return { block: run?.block ?? null };
  });

/**
 * Confirming is the only way anything moves. Each destination is the one the
 * card names: a 1:1 talking point, a prefilled decision draft, a drift fact,
 * or a per work check status. Nothing is aggregated anywhere.
 */
export const confirmHandoffItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ActInput) => {
    if (!input?.run_id || !input?.item_id) throw new Error("run_id and item_id are required");
    return input;
  })
  .handler(async ({ data, context }): Promise<HandoffActResult> => {
    const { confirmOne } = await import("./handoffs-act.server");
    return await confirmOne(context, data.run_id, [data.item_id], data.profile_id ?? null);
  });

export const confirmHandoffBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: BatchInput) => {
    if (!input?.run_id || !Array.isArray(input.item_ids) || input.item_ids.length === 0) {
      throw new Error("run_id and item_ids are required");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<HandoffActResult> => {
    const { confirmOne } = await import("./handoffs-act.server");
    return await confirmOne(context, data.run_id, data.item_ids, data.profile_id ?? null);
  });

export const discardHandoffItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ActInput) => {
    if (!input?.run_id || !input?.item_id) throw new Error("run_id and item_id are required");
    return input;
  })
  .handler(async ({ data, context }): Promise<HandoffActResult> => {
    const { discardOne } = await import("./handoffs-act.server");
    return await discardOne(context, data.run_id, data.item_id, data.profile_id ?? null);
  });

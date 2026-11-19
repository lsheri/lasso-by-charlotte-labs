import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ItemTagsView } from "@/lib/extract-tags-shared";

type ItemInput = { item_id: string; profile_id?: string | null | undefined };
type SaveInput = ItemInput & { method: unknown; call_role: unknown; stage: unknown; situation: unknown; clear: boolean };

function validateItem(input: ItemInput): ItemInput {
  const itemId = typeof input?.item_id === "string" ? input.item_id.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) throw new Error("Unknown item.");
  return { item_id: itemId, profile_id: typeof input?.profile_id === "string" ? input.profile_id : null };
}

/** The values are checked against the lists in buildTagCorrection, on the server, whatever the dialog sent. */
function validateSave(input: SaveInput): SaveInput {
  return {
    ...validateItem(input),
    method: input?.method,
    call_role: input?.call_role,
    stage: input?.stage,
    situation: input?.situation,
    clear: input?.clear === true,
  };
}

/** A member of a company workspace (never a coach or a guest); the board lead or admin check is in item-tags.server. */
async function caller(context: { supabase: Parameters<typeof import("./firm-corpus.server").requireFirmMember>[0]; userId: string }, profileId: string | null | undefined) {
  const { requireFirmMember } = await import("./firm-corpus.server");
  return requireFirmMember(context.supabase, context.userId, profileId);
}

/** The item's firm brain tags, for the board's lead and workspace admins. */
export const readItemTagsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateItem)
  .handler(async ({ data, context }): Promise<ItemTagsView> => {
    const { profile, supabaseAdmin } = await caller(context, data.profile_id);
    const { readItemTags } = await import("./item-tags.server");
    return readItemTags(supabaseAdmin, profile, data.item_id);
  });

/** Saves or removes the lead's correction. A re-extract never overwrites it. */
export const saveItemTagsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateSave)
  .handler(async ({ data, context }): Promise<ItemTagsView> => {
    const { profile, supabaseAdmin } = await caller(context, data.profile_id);
    const { saveItemTags } = await import("./item-tags.server");
    return saveItemTags(supabaseAdmin, profile, data.item_id, data);
  });

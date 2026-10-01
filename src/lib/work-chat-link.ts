import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { pastedChatUrl } from "@/lib/chat-url";

export const CHAT_LINK_INVALID = "That link can't be used. Paste a link that starts with https://";

/**
 * CU1: writes work_items.meta.chat_url through the ordinary item update, so the
 * owner's own row policies decide whether it lands. Other meta keys are kept.
 * null removes the link. Fires no event, and the link never leaves this call.
 */
export async function setChatLink(workItemId: string, raw: string | null): Promise<void> {
  const url = raw === null ? null : pastedChatUrl(raw);
  if (raw !== null && !url) throw new Error(CHAT_LINK_INVALID);

  const { data, error: readError } = await supabase
    .from("work_items")
    .select("meta")
    .eq("id", workItemId)
    .maybeSingle();
  if (readError) throw readError;

  const meta = { ...((data?.meta ?? {}) as Record<string, unknown>) };
  if (url) meta["chat_url"] = url;
  else delete meta["chat_url"];

  const { error } = await supabase
    .from("work_items")
    .update({ meta: meta as Json })
    .eq("id", workItemId);
  if (error) throw error;
}

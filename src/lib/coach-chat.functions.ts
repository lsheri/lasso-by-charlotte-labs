import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateCoachChat } from "@/lib/coach-chat-shared";
import type { CoachChatResult } from "@/lib/coach-chat-run.server";

/** Non-streaming entry point. The streamed one is /api/coach-chat/stream. */
export const askCoachChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validateCoachChat)
  .handler(async ({ data, context }): Promise<CoachChatResult> => {
    const { runCoachChat } = await import("./coach-chat-run.server");
    return runCoachChat(context.supabase, context.userId, data);
  });

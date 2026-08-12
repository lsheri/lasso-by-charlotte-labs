import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ReflectInput, ReflectResult } from "@/lib/reflect-run.server";

/**
 * The non-streaming entry point. The streaming one lives at
 * /api/reflect/stream and runs the exact same turn.
 */
export const sendReflectMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ReflectInput) => input)
  .handler(async ({ data, context }): Promise<ReflectResult> => {
    const { runReflectTurn } = await import("./reflect-run.server");
    return runReflectTurn(context.supabase, context.userId, data);
  });

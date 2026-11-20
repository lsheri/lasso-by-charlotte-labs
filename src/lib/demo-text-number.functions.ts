import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  demoNumberProfileInput,
  demoNumberSaveInput,
  type DemoNumberResult,
  type DemoNumberStatus,
} from "@/lib/demo-text-number-shared";

/**
 * 20 Nov 2026, D-50: a demo workspace's one text number. Each function is requireSupabaseAuth, then its handler in
 * demo-text-number.server.ts, which refuses anyone but an admin of a demo workspace. None of them returns the number.
 */

export const demoNumberStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(demoNumberProfileInput)
  .handler(async ({ data, context }): Promise<DemoNumberStatus> => (await import("./demo-text-number.server")).demoNumberHandlers.status(context, data));

export const saveDemoNumberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(demoNumberSaveInput)
  .handler(async ({ data, context }): Promise<DemoNumberResult> => (await import("./demo-text-number.server")).demoNumberHandlers.save(context, data));

export const clearDemoNumberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(demoNumberProfileInput)
  .handler(async ({ data, context }): Promise<DemoNumberResult> => (await import("./demo-text-number.server")).demoNumberHandlers.clear(context, data));

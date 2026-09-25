/**
 * Product shell 1.3: the public demo entrance. No session is needed and none
 * is read. The only org these can reach is the one marked is_demo.
 */

import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { DemoBoardResult, DemoConversationsResult, DemoHomeResult } from "./demo-board.server";
import type { DemoAdminStatus } from "./demo-presets.server";

export const openDemoHomeFn = createServerFn({ method: "POST" }).handler(async (): Promise<DemoHomeResult> => {
  const { openDemoHome } = await import("./demo-board.server");
  return openDemoHome();
});

export const openDemoConversationsFn = createServerFn({ method: "POST" }).handler(
  async (): Promise<DemoConversationsResult> => {
    const { openDemoConversations } = await import("./demo-board.server");
    return openDemoConversations();
  },
);

export const openDemoBoardFn = createServerFn({ method: "POST" })
  .inputValidator((input: { code: string }) => ({
    code: typeof input?.code === "string" ? input.code.slice(0, 64) : "",
  }))
  .handler(async ({ data }): Promise<DemoBoardResult> => {
    const { openDemoBoard } = await import("./demo-board.server");
    return openDemoBoard(data.code);
  });

/* Unit 2: admin-only regeneration of the demo's saved answers. */

export const demoAdminStatusFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagementId: string }) => ({
    engagementId: typeof input?.engagementId === "string" ? input.engagementId.slice(0, 64) : "",
  }))
  .handler(async ({ data, context }): Promise<DemoAdminStatus> => {
    const { demoAdminStatus } = await import("./demo-presets.server");
    return demoAdminStatus(context.supabase, context.userId, data.engagementId);
  });

export const regenerateDemoPresetsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { engagementId: string }) => ({
    engagementId: typeof input?.engagementId === "string" ? input.engagementId.slice(0, 64) : "",
  }))
  .handler(async ({ data, context }) => {
    const { regenerateDemoPresets } = await import("./demo-presets.server");
    return regenerateDemoPresets(context.supabase, context.userId, data.engagementId);
  });

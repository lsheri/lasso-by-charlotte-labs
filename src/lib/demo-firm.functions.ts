import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { QA_SEED_ORG_ID } from "@/lib/qa-seed.functions";

/**
 * The demo firm for buyer sessions (Liam, 16 Nov). Founder admin only, like the QA seed. The page drives the steps:
 * people first, then one board per call (a single call for 30 boards would outlive the server's time limit), then
 * finish. Every write is scoped to the marked demo workspace and the kestrelbay.test domain.
 */

type Input = { profile_id?: string | undefined };

async function founderOnly(context: { supabase: never; userId: string } | { supabase: unknown; userId: string }, profileId?: string) {
  const { resolveProfile } = await import("./profile-resolve");
  const profile = await resolveProfile(context.supabase as never, context.userId, profileId);
  if (!profile || profile.role !== "admin" || profile.org_id !== QA_SEED_ORG_ID) throw new Error("Forbidden");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type DemoFirmStatus = { exists: boolean; boards: string[] };

export const demoFirmStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }): Promise<DemoFirmStatus> => {
    const admin = await founderOnly(context, data.profile_id);
    const { DEMO_BOARDS } = await import("./demo-firm");
    return { exists: Boolean(await (await import("./demo-firm/seed.server")).findDemoOrg(admin)), boards: DEMO_BOARDS.map((board) => board.key) };
  });

/** Step 1. Returns the one password every demo login shares, shown once to the founder and never stored by us. */
export const seedDemoFirmPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }): Promise<{ password: string; people: number }> => {
    const admin = await founderOnly(context, data.profile_id);
    const { newQaPassword } = await import("./qa-seed.functions");
    const { DEMO_FIRM } = await import("./demo-firm");
    const { seedDemoPeople } = await import("./demo-firm/seed.server");
    const password = newQaPassword();
    const result = await seedDemoPeople(admin, DEMO_FIRM, password);
    return { password, people: result.people };
  });

export const seedDemoFirmBoard = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input & { board: string }) => input)
  .handler(async ({ data, context }): Promise<{ items: number; showings: number; skipped: boolean }> => {
    const admin = await founderOnly(context, data.profile_id);
    const { DEMO_BOARDS } = await import("./demo-firm");
    const board = DEMO_BOARDS.find((entry) => entry.key === data.board);
    if (!board) throw new Error(`No demo board ${data.board}`);
    const { seedDemoBoard } = await import("./demo-firm/seed.server");
    return seedDemoBoard(admin, board);
  });

export const finishDemoFirmSeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const admin = await founderOnly(context, data.profile_id);
    const { finishDemoSeed } = await import("./demo-firm/seed.server");
    await finishDemoSeed(admin);
    return { ok: true };
  });

export const resetDemoFirmFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }): Promise<{ removed: boolean; problems: string[] }> => {
    const admin = await founderOnly(context, data.profile_id);
    const { resetDemoFirm } = await import("./demo-firm/seed.server");
    return resetDemoFirm(admin);
  });

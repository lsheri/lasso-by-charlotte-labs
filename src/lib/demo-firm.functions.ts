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
  .handler(async ({ data, context }): Promise<{ ok: true; proposals: import("./demo-firm/seed.server").ProposalSeedResult | null }> => {
    const admin = await founderOnly(context, data.profile_id);
    const { finishDemoSeed } = await import("./demo-firm/seed.server");
    return { ok: true, proposals: await finishDemoSeed(admin) };
  });

export const resetDemoFirmFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input) => input)
  .handler(async ({ data, context }): Promise<{ removed: boolean; problems: string[] }> => {
    const admin = await founderOnly(context, data.profile_id);
    const { resetDemoFirm } = await import("./demo-firm/seed.server");
    return resetDemoFirm(admin);
  });

/**
 * Firm brain step 5, the check on real model output: runs the card call twice on one seeded item, as it is today and
 * with the tags asked for, and returns what the model wrote, what would be stored and the tokens of both. The seed's
 * own labels are the hand labels (tag-check-shared.ts). One item per call so none outlives the server's time limit.
 * Founder admin only, read only: nothing is written to the item, its card or its board.
 */
export const checkDemoTagFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: Input & { index: number }) => ({ profile_id: input?.profile_id, index: Number.isInteger(input?.index) ? input.index : -1 }))
  .handler(async ({ data, context }): Promise<{ total: number; names: string[]; result: import("./tag-check-shared").TagCheckResult | null }> => {
    const admin = await founderOnly(context, data.profile_id);
    const { DEMO_BOARDS, DEMO_FIRM } = await import("./demo-firm");
    const { tagCheckCases } = await import("./tag-check-shared");
    const cases = tagCheckCases(DEMO_BOARDS);
    // Every person and client name in the demo firm: a role must never hold one.
    const names = [...DEMO_FIRM.people.map((person) => person.name), ...DEMO_BOARDS.map((board) => board.client.name)];
    const entry = cases[data.index];
    if (!entry) return { total: cases.length, names, result: null };

    const none = { tokensIn: 0, tokensOut: 0, costUsd: 0 };
    const { rawTags } = await import("./tag-check-shared");
    const raw = rawTags(null);
    const failed = (note: string) => ({ total: cases.length, names, result: { case: entry, ok: false, note, got: {}, raw, before: none, after: none } });

    const { findDemoOrg } = await import("./demo-firm/seed.server");
    const orgId = await findDemoOrg(admin);
    if (!orgId) return failed("the demo firm is not seeded");
    const { ITEM_TEXT_COLUMNS, pullItemText, generateExtract } = await import("./extract.server");
    const { data: rows } = await admin
      .from("work_items")
      .select(`${ITEM_TEXT_COLUMNS}, owner_id`)
      .eq("org_id", orgId)
      .eq("source_meta->>demo_board", entry.boardKey)
      .eq("title", entry.title)
      .limit(1);
    const row = (rows ?? [])[0] as unknown as (import("./extract.server").ClassifiableItem & { owner_id: string }) | undefined;
    if (!row) return failed("item not found in the demo firm");
    const text = (await pullItemText(admin as never, row)).trim();
    if (!text) return failed("no readable text");

    const board = DEMO_BOARDS.find((candidate) => candidate.key === entry.boardKey)!;
    const item = board.items.find((candidate) => candidate.key === entry.itemKey)!;
    const { situationCarrier } = await import("./demo-firm/plan");
    const { parseTagReply } = await import("./extract-tags-shared");
    const { orgNameFor } = await import("./ai.server");
    const meta = { surface: "extract", orgId, profileId: row.owner_id, orgName: await orgNameFor(admin as never, orgId) };
    const before = await generateExtract(entry.title, text, meta, null);
    const after = await generateExtract(entry.title, text, meta, {
      context: { type: entry.type, carrier: situationCarrier(board) === entry.itemKey, shown: Boolean(item.shown?.length), names },
      brief: situationCarrier(board) === entry.itemKey ? board.brief : null,
      client: board.client.name,
    });
    const usage = (run: { tokensIn: number; tokensOut: number; costUsd: number }) => ({ tokensIn: run.tokensIn, tokensOut: run.tokensOut, costUsd: run.costUsd });
    return {
      total: cases.length,
      names,
      result: {
        case: entry,
        ok: Boolean(before.fields && after.fields),
        note: before.fields && after.fields ? null : "the card could not be read from the model's reply",
        got: after.tags ?? {},
        raw: rawTags(parseTagReply(after.reply)),
        before: usage(before),
        after: usage(after),
      },
    };
  });

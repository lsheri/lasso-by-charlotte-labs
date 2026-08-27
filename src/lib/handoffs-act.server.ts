import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import type { DepartureItem, HandoffBlock, OpenCheckItem } from "@/lib/handoffs-shared";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };
type Result = { block: HandoffBlock | null; duplicate: boolean };

async function resolve(ctx: Ctx, runId: string, profileId: string | null) {
  const { resolveProfile } = await import("./profile-resolve");
  const profile = await resolveProfile(ctx.supabase, ctx.userId, profileId ?? undefined);
  if (!profile) throw new Response("Forbidden", { status: 403 });
  const { ownedRun } = await import("./handoffs.server");
  const run = await ownedRun(runId, profile.id);
  if (!run || !run.block) throw new Response("Forbidden", { status: 403 });
  return { profile, run };
}

async function actedEvent(
  ctx: Ctx,
  args: {
    orgId: string;
    profileId: string;
    preset: string;
    kind: string;
    action: "confirmed" | "discarded" | "batch_confirmed";
    destination: string;
  },
): Promise<void> {
  try {
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(ctx.supabase, {
      eventType: "analysis.handoff_acted",
      orgId: args.orgId,
      userId: ctx.userId,
      dims: {
        preset: args.preset,
        kind: args.kind,
        action: args.action,
        destination: args.destination,
      },
    });
    const { recordEventV2 } = await import("./telemetry-v2.server");
    await recordEventV2(ctx.supabase, ctx.userId, {
      eventName: "analysis.handoff_acted",
      props: {
        preset: args.preset,
        kind: args.kind,
        action: args.action,
        destination: args.destination,
      },
      profileId: args.profileId,
    });
  } catch {
    // A missed count never blocks the person's own decision.
  }
}

/** Where a confirmed item of each kind goes, said plainly. */
export const HANDOFF_DESTINATION: Record<string, string> = {
  open_checks: "one_on_one_notes",
  decision_candidates: "decision_drafter",
  departures: "facts",
  check_results: "work_status",
};

export async function confirmOne(
  ctx: Ctx,
  runId: string,
  itemIds: string[],
  profileId: string | null,
  /**
   * Pass 128: "Checked it myself" settles the item and nothing else. No 1:1
   * note is written, and the acted count says the destination was none.
   */
  options?: { selfCheck?: boolean; note?: string },
): Promise<Result> {
  const selfCheck = options?.selfCheck === true;
  const { profile, run } = await resolve(ctx, runId, profileId);
  const block = run.block!;
  let duplicate = false;
  let current = block;

  for (const itemId of itemIds) {
    const item = current.items.find((row) => row.id === itemId);
    if (!item || item.state !== "draft") continue;

    if (current.kind === "open_checks" && !selfCheck) {
      const { openCheckNote, sendOpenCheckToOneOnOne } = await import("./handoffs.server");
      const content = openCheckNote(item.fields as OpenCheckItem);
      const sent = await sendOpenCheckToOneOnOne(ctx.supabase, {
        orgId: run.org_id,
        profileId: profile.id,
        sessionId: run.session_id,
        content,
      });
      duplicate = duplicate || sent.duplicate;
    } else if (current.kind === "departures") {
      // Fingerprints and shapes only. No quote ever reaches the facts plane.
      const { writeAnalysisFinding } = await import("./facts.server");
      const fields = item.fields as DepartureItem;
      await writeAnalysisFinding(
        { supabase: ctx.supabase, orgId: run.org_id, profileId: profile.id },
        {
          analysisRunId: run.id,
          presetId: `still_on_brief.${fields.class.toLowerCase()}`,
          presetVersion: "v1",
          scope: run.scope_type,
          evidenceCount: 1,
        },
      ).catch(() => undefined);
    }
    // decision_candidates prefill the existing drafter on the client and
    // check_results are a per work status; both are stamped, nothing else.

    const { stampItem, ownedRun } = await import("./handoffs.server");
    await stampItem(run.id, current, itemId, "confirmed", options?.note);
    const refreshed = await ownedRun(run.id, profile.id);
    current = refreshed?.block ?? current;
  }

  await actedEvent(ctx, {
    orgId: run.org_id,
    profileId: profile.id,
    preset: run.preset,
    kind: current.kind,
    action: itemIds.length > 1 ? "batch_confirmed" : "confirmed",
    destination: selfCheck ? "none" : (HANDOFF_DESTINATION[current.kind] ?? "none"),
  });
  return { block: current, duplicate };
}

export async function discardOne(
  ctx: Ctx,
  runId: string,
  itemId: string,
  profileId: string | null,
): Promise<Result> {
  const { profile, run } = await resolve(ctx, runId, profileId);
  const { stampItem, ownedRun } = await import("./handoffs.server");
  await stampItem(run.id, run.block!, itemId, "discarded");
  const refreshed = await ownedRun(run.id, profile.id);
  await actedEvent(ctx, {
    orgId: run.org_id,
    profileId: profile.id,
    preset: run.preset,
    kind: run.block!.kind,
    action: "discarded",
    destination: "none",
  });
  return { block: refreshed?.block ?? null, duplicate: false };
}

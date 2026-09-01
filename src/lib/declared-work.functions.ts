import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

import {
  parseArtifactDeclaration,
  parseCoachOutcome,
  parseWorkflowDeclaration,
  type ArtifactDeclaration,
  type CoachOutcome,
  type WorkflowDeclaration,
} from "./declared-work";

type ArtifactInput = { work_item_id: string } & ArtifactDeclaration;
type WorkflowInput = { work_item_ids: string[] } & WorkflowDeclaration;
type OutcomeInput = { engagement_id: string } & CoachOutcome;

/**
 * What the person said about their own finished work. The declaration is kept
 * on the item so the card can wear it, and the same values are recorded once.
 */
export const declareArtifact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ArtifactInput) => {
    if (!input?.work_item_id) throw new Error("work_item_id is required");
    return { work_item_id: input.work_item_id, ...parseArtifactDeclaration(input) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: item } = await supabase
      .from("work_items")
      .select("id, org_id, owner_id, meta")
      .eq("id", data.work_item_id)
      .maybeSingle();
    if (!item) return { ok: true };

    const declared = {
      output_kind: data.output_kind,
      disposition: data.disposition,
      ai_involvement: data.ai_involvement,
    };
    const meta = { ...((item.meta ?? {}) as Record<string, unknown>), declared };
    await supabase.from("work_items").update({ meta: meta as Json }).eq("id", item.id);

    const { noteArtifactDeclared } = await import("./declared-work.server");
    await noteArtifactDeclared(
      supabase as never,
      { orgId: item.org_id, userId, profileId: item.owner_id },
      declared,
    );
    return { ok: true };
  });

/** How the person worked, said at the moment the work is mapped. */
export const declareWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: WorkflowInput) => {
    const ids = (input?.work_item_ids ?? []).filter((id) => typeof id === "string").slice(0, 50);
    if (ids.length === 0) throw new Error("work_item_ids is required");
    return { work_item_ids: ids, ...parseWorkflowDeclaration(input) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: items } = await supabase
      .from("work_items")
      .select("id, org_id, owner_id")
      .in("id", data.work_item_ids);
    const first = items?.[0];
    if (!first) return { ok: true };

    const { noteWorkflowDeclared } = await import("./declared-work.server");
    await noteWorkflowDeclared(
      supabase as never,
      { orgId: first.org_id, userId, profileId: first.owner_id },
      { process_steps: data.process_steps, task_class: data.task_class },
    );
    return { ok: true };
  });

/** A coach's read on work they reviewed. Coaches only. */
export const declareCoachOutcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: OutcomeInput) => {
    if (!input?.engagement_id) throw new Error("engagement_id is required");
    return { engagement_id: input.engagement_id, ...parseCoachOutcome(input) };
  })
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, role, org_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!profile || profile.role !== "coach") throw new Response("Forbidden", { status: 403 });

    const { data: engagement } = await supabase
      .from("engagements")
      .select("id, org_id")
      .eq("id", data.engagement_id)
      .maybeSingle();
    if (!engagement) return { ok: true };

    const { noteCoachOutcome } = await import("./declared-work.server");
    await noteCoachOutcome(
      supabase as never,
      { orgId: engagement.org_id, userId, profileId: profile.id },
      {
        verdict: data.verdict,
        rubric_band: data.rubric_band,
        rework_needed: data.rework_needed,
      },
    );
    return { ok: true };
  });

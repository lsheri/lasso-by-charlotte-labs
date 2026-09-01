import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  parseArtifactDeclaration,
  parseCoachOutcome,
  parseWorkflowDeclaration,
} from "./declared-work";
import { recordEvent } from "./telemetry.server";

/**
 * Pass 150 emitters. Every value passes the closed-vocabulary parser before it
 * reaches recordEvent, so an invalid choice never becomes a row.
 */

type Actor = {
  orgId: string;
  userId: string | null | undefined;
  profileId?: string | null | undefined;
};

export async function noteArtifactDeclared(
  supabase: SupabaseClient<Database>,
  actor: Actor,
  input: unknown,
): Promise<void> {
  const declared = parseArtifactDeclaration(input);
  await recordEvent(supabase, {
    eventType: "artifact.declared",
    orgId: actor.orgId,
    userId: actor.userId,
    profileId: actor.profileId ?? null,
    dims: { ...declared },
  });
}

export async function noteWorkflowDeclared(
  supabase: SupabaseClient<Database>,
  actor: Actor,
  input: unknown,
): Promise<void> {
  const declared = parseWorkflowDeclaration(input);
  await recordEvent(supabase, {
    eventType: "workflow.declared",
    orgId: actor.orgId,
    userId: actor.userId,
    profileId: actor.profileId ?? null,
    dims: {
      process_steps: declared.process_steps.join(","),
      step_count: declared.process_steps.length,
      task_class: declared.task_class,
    },
  });
}

export async function noteCoachOutcome(
  supabase: SupabaseClient<Database>,
  actor: Actor,
  input: unknown,
): Promise<void> {
  const outcome = parseCoachOutcome(input);
  await recordEvent(supabase, {
    eventType: "coach.outcome",
    orgId: actor.orgId,
    userId: actor.userId,
    profileId: actor.profileId ?? null,
    dims: { ...outcome },
  });
}

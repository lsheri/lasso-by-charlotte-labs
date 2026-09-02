import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { modelRawOf, modelSwitched, normalizeModelId, UNDISCLOSED } from "./model-registry";
import { recordEvent } from "./telemetry.server";
import {
  artifactKindFromItem,
  taskClassForItem,
  threadShapeDims,
  turnBand,
  vendorFromSource,
  type CaptureVia,
  type TaxonomyItem,
  type VendorSource,
} from "./work-taxonomy";

/**
 * Pass 148 emitters. Server side only, one call per capture, everything
 * banded or from a closed vocabulary before it reaches recordEvent.
 */

type Actor = {
  orgId: string;
  userId: string | null | undefined;
  profileId?: string | null | undefined;
};

export type CapturedItem = TaxonomyItem & VendorSource;

/** One captured item, one row. Callers must only call this for NEW rows. */
export async function noteModelUsed(
  supabase: SupabaseClient<Database>,
  actor: Actor,
  input: {
    item: CapturedItem;
    via: CaptureVia;
    turnCount?: number | null | undefined;
    /** Pass 155: exact machine identifiers seen for this conversation. */
    modelRaws?: readonly unknown[] | undefined;
  },
): Promise<void> {
  const raws = input.modelRaws ?? [];
  const primary = raws.find((r) => modelRawOf(r) !== UNDISCLOSED);
  const dims: Record<string, string | boolean> = {
    vendor: vendorFromSource(input.item),
    task_class: taskClassForItem(input.item),
    via: input.via,
    model_raw: modelRawOf(primary),
    model_id: normalizeModelId(primary),
    model_switched: modelSwitched(raws),
  };
  if (typeof input.turnCount === "number") dims["turn_band"] = turnBand(input.turnCount);
  await recordEvent(supabase, {
    eventType: "model.used",
    orgId: actor.orgId,
    userId: actor.userId,
    profileId: actor.profileId ?? null,
    dims,
  });
}

/** The shape of a captured thread. Re-pushes re-emit: the shape has changed. */
export async function noteThreadShape(
  supabase: SupabaseClient<Database>,
  actor: Actor,
  turns: readonly { role: string; length: number }[],
): Promise<void> {
  await recordEvent(supabase, {
    eventType: "thread.shape",
    orgId: actor.orgId,
    userId: actor.userId,
    profileId: actor.profileId ?? null,
    dims: threadShapeDims(turns),
  });
}

/** A link between two pieces of work: which tool fed which, and into what. */
export async function noteHandoffObserved(
  supabase: SupabaseClient<Database>,
  actor: Actor,
  input: { from: CapturedItem | null; to: CapturedItem | null },
): Promise<void> {
  await recordEvent(supabase, {
    eventType: "handoff.observed",
    orgId: actor.orgId,
    userId: actor.userId,
    profileId: actor.profileId ?? null,
    dims: {
      from_tool: vendorFromSource(input.from),
      to_tool: vendorFromSource(input.to),
      artifact_kind: artifactKindFromItem(input.to),
    },
  });
}

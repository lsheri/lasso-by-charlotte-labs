import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveProfile } from "@/lib/profile-resolve";
import { setWorkItemStandalone, type StandAloneResult } from "@/lib/work-standalone.server";

/**
 * W2: let one artifact stand on its own, or put it back with its chat. One
 * stamp on the record either way, written on the caller's own client so row
 * level security decides whether they may.
 */
export const setWorkItemStandaloneFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { work_item_id: string; stand_alone: boolean; profile_id?: string | undefined }) => ({
      work_item_id: typeof input?.work_item_id === "string" ? input.work_item_id : "",
      stand_alone: input?.stand_alone === true,
      profile_id: input?.profile_id ?? null,
    }),
  )
  .handler(async ({ data, context }): Promise<StandAloneResult> => {
    if (!data.work_item_id) return { status: "forbidden" };
    const { supabase, userId } = context;
    const profile = await resolveProfile(supabase, userId, data.profile_id);
    if (!profile) return { status: "forbidden" };

    const result = await setWorkItemStandalone(supabase, profile, {
      workItemId: data.work_item_id,
      standAlone: data.stand_alone,
    });

    if (result.status === "saved") {
      try {
        const { recordEvent } = await import("./telemetry.server");
        // Every lift and every put back, including the inbox-only case where
        // nothing board-shaped happened. That case is the common one.
        await recordEvent(supabase, {
          eventType: "work.piece_regrouped",
          orgId: profile.org_id,
          userId,
          profileId: profile.id,
          dims: {
            action: result.standsAlone ? "stands_alone" : "put_back",
            piece_kind: result.pieceKind,
            vendor: result.vendor,
            on_board: result.linkedOnBoard,
          },
        });
      } catch {
        // Reorganising work must never depend on recording this signal.
      }
    }

    if (result.status === "saved" && result.linkedOnBoard) {
      try {
        const { recordEvent } = await import("./telemetry.server");
        // Existing names only, with widened dimension values: the artifact was
        // brought onto the board its conversation already sits on, and the
        // relationship between the two was drawn.
        await recordEvent(supabase, {
          eventType: "workboard.work_added",
          orgId: profile.org_id,
          userId,
          profileId: profile.id,
          dims: { source: "conversation_artifact", via: "stands_alone", count: 1 },
        });
        await recordEvent(supabase, {
          eventType: "workboard.relationship_changed",
          orgId: profile.org_id,
          userId,
          profileId: profile.id,
          dims: { action: "created", relation: "produced" },
        });
      } catch {
        // Reorganising work must never depend on recording this signal.
      }
    }

    return result;
  });

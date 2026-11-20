import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rosterListInput,
  rosterSaveInput,
  type RosterList,
  type RosterSaveResult,
} from "@/lib/roster-shared";

/**
 * 19 Nov 2026, Proposal Desk: the roster's server functions. Each is requireSupabaseAuth, then its handler in
 * roster.server.ts, which starts with requireFirmMember (an active member of a company workspace, never a coach or a
 * guest) and then asks for an admin or a lead. No flag sits in front of the panel. Neither function takes or returns
 * a phone number.
 */

/** The people this workspace works with, each with one word for their text agreement. Admins and leads only. */
export const listRosterFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rosterListInput)
  .handler(async ({ data, context }): Promise<RosterList> =>
    (await import("./roster.server")).rosterHandlers.list(context as never, data),
  );

/** Adds a person or corrects one. Admins and leads only. */
export const saveRosterContactFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rosterSaveInput)
  .handler(async ({ data, context }): Promise<RosterSaveResult> =>
    (await import("./roster.server")).rosterHandlers.save(context as never, data),
  );

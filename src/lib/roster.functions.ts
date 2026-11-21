import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  rosterChangeInput,
  rosterListInput,
  rosterSaveInput,
  teammateLinkInput,
  type RosterChangeResult,
  type TeammateLinkResult,
  type RosterInviteResult,
  type RosterList,
  type RosterSaveResult,
} from "@/lib/roster-shared";

/**
 * 19 Nov 2026, Proposal Desk: the roster's server functions. Each is requireSupabaseAuth, then its handler in
 * roster.server.ts, which starts with requireFirmMember (an active member of a company workspace, never a coach or a
 * guest) and then asks for an admin or a lead. No flag sits in front of the panel. A save takes the number an admin
 * or lead types; no function returns a full number, only one masked to its last four digits.
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

/**
 * Asks one roster person for a new number: opens a short window in which their own link accepts one. Admins and
 * leads only. Takes an id and nothing else; no number is typed, sent or returned.
 */
export const askNewNumberFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rosterChangeInput)
  .handler(async ({ data, context }): Promise<RosterChangeResult> =>
    (await import("./roster.server")).rosterHandlers.askNewNumber(context as never, data),
  );

/**
 * 20 Nov 2026: emails one person their own text agreement link. Admins and leads only, at most once every ten minutes
 * per person. The email asks; it agrees to nothing. Takes an id and nothing else; no address is typed here. It returns
 * the person's row, which already carries their email for the admins and leads who may call this.
 */
export const sendRosterInviteFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(rosterChangeInput)
  .handler(async ({ data, context }): Promise<RosterInviteResult> =>
    (await import("./roster.server")).rosterHandlers.invite(context as never, data),
  );

/**
 * 21 Nov 2026, chat pill PR 4a (D-97): links a teammate with a login to their People row, or makes one, so they can
 * lead a proposal. Admins and leads only. Takes a teammate's id and nothing else; sends nothing and agrees to nothing.
 */
export const linkTeammateFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(teammateLinkInput)
  .handler(async ({ data, context }): Promise<TeammateLinkResult> =>
    (await import("./roster.server")).rosterHandlers.linkTeammate(context as never, data),
  );

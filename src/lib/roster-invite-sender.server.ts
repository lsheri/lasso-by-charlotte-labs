/**
 * 20 Nov 2026: the one place an email to a roster person would leave from. It sends nothing today.
 *
 * Liam is deciding which service carries every message (email as well as text), so no sender is wired here yet.
 * Whichever is chosen goes behind this one function; the rule around it (who may ask, which address, how often,
 * what the email says) is `sendRosterInvite` in roster.server.ts and does not change.
 */
import type { RosterInviteMail } from "./roster.server";

export type RosterInviteSend = "sent" | "not_set_up" | "failed";

/** Sends nothing and says so. Replace the body, not the callers. */
export async function sendRosterInviteMail(_mail: RosterInviteMail): Promise<RosterInviteSend> {
  return "not_set_up";
}

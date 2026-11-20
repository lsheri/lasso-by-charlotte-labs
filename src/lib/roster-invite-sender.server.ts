/**
 * The one place an email to a roster person leaves from (20 Nov 2026, chat pill build Phase 2). It goes through Resend,
 * the service that already sends workspace invites, from the same address. The rule around it (who may ask, which
 * address, how often, what the email says) is `sendRosterInvite` in roster.server.ts and does not change.
 * No key set: nothing is sent and the caller says so ("not_set_up"); the admin can still copy the link.
 * Never logs the address, the name or the link.
 */
import type { RosterInviteMail } from "./roster.server";

export type RosterInviteSend = "sent" | "not_set_up" | "failed";

export async function sendRosterInviteMail(mail: RosterInviteMail): Promise<RosterInviteSend> {
  const { resendApiKey, inviteSenderAddress, sendViaResend } = await import("./invites.server");
  const key = resendApiKey();
  if (!key) return "not_set_up";
  const { rosterInviteEmail } = await import("./roster.server");
  const words = rosterInviteEmail({ name: mail.name, workspace: mail.workspace, link: mail.link });
  try {
    // Replies go where the workspace invite's replies go, when that address is set here; never to the no-reply sender.
    const replyTo = process.env["RESEND_REPLY_TO"] || undefined;
    const result = await sendViaResend(key, { from: inviteSenderAddress(), to: mail.to, subject: words.subject, html: words.html, text: words.text, replyTo });
    return result.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

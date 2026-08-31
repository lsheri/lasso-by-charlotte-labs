/**
 * The one branded invitation email. Email clients ignore CSS custom
 * properties, so the notebook palette is mirrored here as literals, and the
 * whole thing is a pure function so it can be read in a test.
 */

export const MAIL = {
  paper: "#fafafa",
  card: "#ffffff",
  rule: "#e4e2dd",
  ink: "#111413",
  muted: "#5a5d5c",
  cta: "#12653d",
} as const;

export const MAIL_FOOTER = "Sent by Lasso · lasso.charlotte-labs.com";

const FONT =
  "Archivo, 'Archivo', 'Helvetica Neue', Helvetica, Arial, sans-serif";
const MONO = "'SFMono-Regular', Menlo, Consolas, 'Liberation Mono', monospace";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type InviteEmail = { subject: string; html: string; text: string };

export function inviteSubject(inviterName: string, orgName: string): string {
  return `${inviterName} invited you to join ${orgName} on Lasso`;
}

export function renderInviteEmail(args: {
  inviterName: string;
  orgName: string;
  acceptUrl: string;
}): InviteEmail {
  const { inviterName, orgName, acceptUrl } = args;
  const lead = `${inviterName} invited you to join ${orgName} on Lasso.`;
  const body =
    "Lasso is where a team keeps a clear record of the work it does with AI, so the thinking behind a deliverable can be reviewed and coached.";

  const text = [
    "LASSO",
    "by Charlotte Labs",
    "",
    lead,
    "",
    body,
    "",
    `Accept your invite: ${acceptUrl}`,
    "",
    MAIL_FOOTER,
  ].join("\n");

  const html = `<!doctype html><html><body style="margin:0;padding:32px 16px;background:${MAIL.paper};font-family:${FONT};color:${MAIL.ink}">
<div style="max-width:520px;margin:0 auto">
<div style="background:${MAIL.ink};border-radius:10px;padding:18px 20px">
<div style="font-family:${MONO};font-size:20px;letter-spacing:0.24em;color:#ffffff">LASSO</div>
<div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;color:#b9bcba;margin-top:6px">by Charlotte Labs</div>
</div>
<div style="background:${MAIL.card};border:1px solid ${MAIL.rule};border-radius:10px;padding:24px;margin-top:16px">
<p style="font-size:16px;line-height:1.6;margin:0 0 12px">${escapeHtml(lead)}</p>
<p style="font-size:15px;line-height:1.6;margin:0;color:${MAIL.muted}">${escapeHtml(body)}</p>
<p style="margin:28px 0 8px"><a href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:${MAIL.cta};color:#ffffff;text-decoration:none;padding:13px 22px;border-radius:8px;font-size:15px;font-weight:600">Accept your invite</a></p>
<p style="font-size:13px;line-height:1.6;color:${MAIL.muted}">Or paste this link into your browser:<br>${escapeHtml(acceptUrl)}</p>
</div>
<p style="font-family:${MONO};font-size:11px;letter-spacing:0.08em;color:${MAIL.muted};margin-top:20px">${escapeHtml(MAIL_FOOTER)}</p>
</div></body></html>`;

  return { subject: inviteSubject(inviterName, orgName), html, text };
}

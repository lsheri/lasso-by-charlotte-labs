/**
 * The one branded invitation email. Email clients ignore CSS custom
 * properties, so the notebook palette is mirrored here as literals, and the
 * whole thing is a pure function so it can be read in a test.
 */

export const MAIL = {
  paper: "#fafafa",
  card: "#ffffff",
  rule: "#e3e5e1",
  ink: "#111413",
  body: "#2f3331",
  muted: "#8b8f8d",
  cta: "#12653d",
} as const;

export const MAIL_FOOTER = "Sent by Lasso · lasso.charlotte-labs.com";

const FONT = "Arial, Helvetica, sans-serif";
const MONO = "'JetBrains Mono', 'Courier New', Courier, monospace";
const TITLE = "'Caveat', 'Segoe Script', 'Bradley Hand', cursive";
const TITLE_FACE = "Archivo, Helvetica, Arial, sans-serif";
const CAVEAT_HREF =
  "https://fonts.googleapis.com/css2?family=Caveat:wght@700&display=swap";
// Animated mascot mark hosted on the umbrella domain; referenced, not copied.
export const LASSO_MARK_URL = "https://charlotte-labs.com/email/lasso-mark.gif";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type InviteEmail = { subject: string; html: string; text: string };

export function inviteSubject(_inviterName: string, orgName: string): string {
  return orgName ? `You are invited to ${orgName}` : "You are invited";
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
    "You are invited",
    "",
    lead,
    "",
    body,
    "",
    `Accept your invite: ${acceptUrl}`,
    "",
    "If you were not expecting this, you can ignore it and nothing happens.",
    "",
    MAIL_FOOTER,
  ].join("\n");

  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${CAVEAT_HREF}"><style>
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: ${MAIL.cta} !important; color: #ffffff !important; }
  }
  [data-ogsc] .dm-btn { background-color: ${MAIL.cta} !important; color: #ffffff !important; }
  [data-ogsb] .dm-btn { background-color: ${MAIL.cta} !important; color: #ffffff !important; }
</style></head><body style="margin:0;padding:28px 16px;background:${MAIL.paper};font-family:${FONT};color:${MAIL.body}">
<div style="max-width:540px;margin:0 auto">
<div style="background:${MAIL.ink};border-radius:8px;padding:18px 20px">
<div style="font-family:${MONO};font-size:20px;letter-spacing:0.24em;color:#ffffff">LASSO</div>
<div style="font-family:${MONO};font-size:11px;letter-spacing:0.16em;color:#b9bcba;margin-top:6px">by Charlotte Labs</div>
</div>
<div style="background:${MAIL.card};border:1px solid ${MAIL.rule};border-radius:8px;padding:26px 24px;margin-top:16px">
<p style="font-family:${TITLE};font-size:30px;font-weight:bold;color:${MAIL.ink};margin:0 0 14px">You are invited</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 14px">${escapeHtml(lead)}</p>
<p style="font-size:14px;line-height:1.6;margin:0;color:${MAIL.body}">${escapeHtml(body)}</p>
<p style="margin:26px 0 8px"><a class="dm-btn" href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:${MAIL.cta};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:600">Accept your invite</a></p>
<p style="font-size:12px;line-height:1.6;color:${MAIL.muted}">Or paste this link into your browser:<br>${escapeHtml(acceptUrl)}</p>
</div>
<p style="font-family:${MONO};font-size:11px;letter-spacing:0.08em;color:${MAIL.muted};margin-top:18px">${escapeHtml(MAIL_FOOTER)}</p>
</div></body></html>`;

  return { subject: inviteSubject(inviterName, orgName), html, text };
}

/**
 * The one branded invitation email. Email clients ignore CSS custom
 * properties, so the notebook palette is mirrored here as literals, and the
 * whole thing is a pure function so it can be read in a test.
 */

export const MAIL = {
  paper: "#fafaf8",
  card: "#ffffff",
  rule: "#dadad5",
  pencil: "#b9bbb6",
  ink: "#16181a",
  body: "#2a2d2b",
  muted: "#9a9c98",
  cta: "#2a2d2b",
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

/** Which of the three invitation letters a given invite deserves. */
export type InviteVariant = "coach_personal" | "coach_business" | "standard";

export function inviteEmailVariant(
  role?: string | null | undefined,
  orgType?: "personal" | "business" | null | undefined,
): InviteVariant {
  if (role !== "coach") return "standard";
  return orgType === "business" ? "coach_business" : "coach_personal";
}

/** "a", "a and b", "a, b and c". Empty list gives an empty string. */
export function joinNames(names: readonly string[]): string {
  const clean = names.map((name) => name.trim()).filter(Boolean);
  if (clean.length === 0) return "";
  if (clean.length === 1) return clean[0] as string;
  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1] as string}`;
}

export function inviteSubject(_inviterName: string, orgName: string): string {
  return orgName ? `You are invited to ${orgName}` : "You are invited";
}

export function renderInviteEmail(args: {
  inviterName: string;
  orgName: string;
  acceptUrl: string;
  role?: string | null | undefined;
  orgType?: "personal" | "business" | null | undefined;
  subjectNames?: string[] | undefined;
}): InviteEmail {
  const { inviterName, orgName, acceptUrl } = args;
  const variant = inviteEmailVariant(args.role, args.orgType);
  const names = joinNames(args.subjectNames ?? []);

  let heading = "You are invited";
  let subject = inviteSubject(inviterName, orgName);
  let lead = `${inviterName} invited you to join ${orgName} on Lasso.`;
  let body =
    "Lasso is where a team keeps a clear record of the work it does with AI, so the thinking behind a deliverable can be reviewed and coached.";
  let cta = "Accept your invite";

  if (variant === "coach_personal") {
    subject = `${inviterName} asked you to coach their work`;
    heading = "You are invited to coach";
    lead = `${inviterName} keeps a record in Lasso of how they work with AI: the conversations and drafts behind a finished piece, not just the file. They would like you to look at that record and coach them on it.`;
    body =
      "You will see only the work they choose to share with you. Nothing else in their workspace is visible to you.";
    cta = "Accept and take a look";
  } else if (variant === "coach_business") {
    subject = `You are invited to coach at ${orgName}`;
    heading = "You are invited to coach";
    lead = `${inviterName} invited you to coach at ${orgName}. Lasso keeps a record of how people work with AI, so the thinking behind a piece of work can be reviewed and coached, not just the finished file.`;
    body = names
      ? `You will see the work of the people you were added to: ${names}. Nothing else in the workspace is visible to you.`
      : "You will see the work of the people you were added to, and nothing else in the workspace.";
    cta = "Accept and start coaching";
  }


  const text = [
    "LASSO",
    "by Charlotte Labs",
    "",
    heading,
    "",
    lead,
    "",
    body,
    "",
    `${cta}: ${acceptUrl}`,
    "",
    "If you were not expecting this, you can ignore it and nothing happens.",
    "",
    MAIL_FOOTER,
  ].join("\n");

  const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${CAVEAT_HREF}"><style>
  @media (prefers-color-scheme: dark) {
    .dm-btn { background-color: ${MAIL.paper} !important; color: ${MAIL.ink} !important; }
  }
  [data-ogsc] .dm-btn { background-color: ${MAIL.paper} !important; color: ${MAIL.ink} !important; }
  [data-ogsb] .dm-btn { background-color: ${MAIL.paper} !important; color: ${MAIL.ink} !important; }
</style></head><body style="margin:0;padding:28px 16px;background:${MAIL.paper};font-family:${FONT};color:${MAIL.body}">
<div style="max-width:544px;margin:0 auto">
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle"><img src="${LASSO_MARK_URL}" alt="Lasso" width="44" height="44"></td>
<td style="vertical-align:middle;padding-left:12px">
<div style="font-family:${TITLE_FACE};font-size:19px;font-weight:600;letter-spacing:6px;color:${MAIL.ink}">LASSO</div>
<div style="font-family:${MONO};font-size:10px;letter-spacing:3px;color:${MAIL.muted};margin-top:4px">BY CHARLOTTE LABS</div>
</td>
</tr></table>
<div style="background:${MAIL.card};border:1px solid ${MAIL.rule};border-radius:8px;padding:26px 24px;margin-top:16px">
<p style="font-family:${TITLE};font-size:30px;font-weight:bold;color:${MAIL.ink};margin:0 0 14px">${escapeHtml(heading)}</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 14px">${escapeHtml(lead)}</p>
<p style="font-size:14px;line-height:1.6;margin:0;color:${MAIL.body}">${escapeHtml(body)}</p>
<p style="margin:26px 0 8px"><a class="dm-btn" href="${escapeHtml(acceptUrl)}" style="display:inline-block;background:${MAIL.cta};color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-size:14px;font-weight:600">${escapeHtml(cta)}</a></p>
<p style="font-size:12px;line-height:1.6;color:${MAIL.muted}">Or paste this link into your browser:<br>${escapeHtml(acceptUrl)}</p>
</div>
<p style="font-family:${MONO};font-size:11px;letter-spacing:0.08em;color:${MAIL.muted};margin-top:18px">${escapeHtml(MAIL_FOOTER)}</p>
</div></body></html>`;

  return { subject, html, text };
}

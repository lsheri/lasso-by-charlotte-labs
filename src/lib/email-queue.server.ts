/**
 * Unit S3: drains public.outbound_emails through the existing Resend sender.
 * Service role only. Rows are claimed atomically before sending so two
 * sweeps never send the same email twice. Operational, not a product event.
 */
import { attendeeLink, buildJoinUrl } from "./join-link";
import { escapeHtml } from "./escape-html";
import { CANONICAL_ORIGIN } from "./app-host";
import { REGISTER_COPY, type Register } from "./register";

export const EMAIL_BATCH = 10;
export const MAX_ATTEMPTS = 5;

export type EmailQueueResult = { sent: number; failed: number; skipped: number };

type Row = {
  id: string;
  to_email: string;
  template: string;
  payload: Record<string, unknown> | null;
  attempts: number;
};

type Db = { from: (t: string) => any };

/** Unknown or missing register falls back to the company promise, never an empty line. */
export function privacyLineFor(register: unknown): string {
  if (typeof register === "string" && Object.prototype.hasOwnProperty.call(REGISTER_COPY, register)) {
    return REGISTER_COPY[register as Register].privacy;
  }
  return REGISTER_COPY.company.privacy;
}

export function buildVariables(
  payload: Record<string, unknown> | null,
  template?: string,
): Record<string, string | number> {
  const p = payload ?? {};
  const out: Record<string, string | number> = {
    WORKSPACE_NAME: escapeHtml(String(p["WORKSPACE_NAME"] ?? "")),
    JOIN_URL:
      p["LINK_KIND"] === "attendee"
        ? attendeeLink(String(p["CODE"] ?? ""), typeof p["REGISTER"] === "string" ? p["REGISTER"] : undefined)
        : buildJoinUrl(String(p["CODE"] ?? "")),
    PRIVACY_LINE: privacyLineFor(p["REGISTER"]),
    PARTNER_NAME: escapeHtml(String(p["PARTNER_NAME"] ?? "")),
  };
  // AU-1: a key that is not a number is left out, never sent as 0.
  // SH-6d-1: support access letters. Person-typed text is escaped.
  for (const k of ["REASON", "ENDS_ON", "CONVERSATIONS"] as const) {
    if (p[k] !== undefined && p[k] !== null) out[k] = escapeHtml(String(p[k]));
  }
  for (const k of ["SEATS", "EXPIRES_DAYS", "DAYS"] as const) {
    const v = p[k];
    const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
    if (Number.isFinite(n)) out[k] = n;
  }
  if (typeof template === "string" && template.startsWith("support-access-")) {
    out["SUPPORT_URL"] = supportUrl(template, p["GRANT_ID"]);
  }
  return out;
}

/** The granted letter opens the grant; the others open Settings, Support access. */
export function supportUrl(template: string, grantId: unknown): string {
  const settings = `${CANONICAL_ORIGIN}/settings?section=support`;
  if (template !== "support-access-granted") return settings;
  if (typeof grantId !== "string" || !/^[0-9a-f-]{36}$/.test(grantId)) return settings;
  return `${CANONICAL_ORIGIN}/support/${grantId}`;
}

async function markFailed(db: Db, id: string, message: string) {
  await db
    .from("outbound_emails")
    .update({ status: "failed", last_error: message.slice(0, 500) })
    .eq("id", id);
}

export async function runEmailQueue(): Promise<EmailQueueResult> {
  const result: EmailQueueResult = { sent: 0, failed: 0, skipped: 0 };
  try {
    const { resendApiKey, sendResendTemplate } = await import("./invites.server");
    const apiKey = resendApiKey();
    if (!apiKey) return result;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // The table is newer than the generated types.
    const db = supabaseAdmin as unknown as Db;

    const { data: pending, error } = await db
      .from("outbound_emails")
      .select("id, to_email, template, payload, attempts")
      .in("status", ["queued", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      .order("created_at", { ascending: true })
      .limit(EMAIL_BATCH);
    if (error || !pending) return result;

    for (const row of pending as Row[]) {
      // Claim: one statement, matches only while still pending at the attempts we read.
      const { data: claimed } = await db
        .from("outbound_emails")
        .update({ status: "sending", attempts: row.attempts + 1 })
        .eq("id", row.id)
        .eq("attempts", row.attempts)
        .in("status", ["queued", "failed"])
        .lt("attempts", MAX_ATTEMPTS)
        .select("id");
      if (!claimed || claimed.length === 0) {
        result.skipped++;
        continue;
      }
      try {
        const sent = await sendResendTemplate(apiKey, {
          to: row.to_email,
          template: row.template,
          variables: buildVariables(row.payload, row.template),
        });
        if (sent.ok) {
          await db
            .from("outbound_emails")
            .update({ status: "sent", sent_at: new Date().toISOString(), provider_id: sent.id, last_error: null })
            .eq("id", row.id);
          result.sent++;
        } else {
          await markFailed(db, row.id, `${sent.status}: ${sent.detail}`);
          result.failed++;
        }
      } catch (e) {
        await markFailed(db, row.id, e instanceof Error ? e.message : String(e));
        result.failed++;
      }
    }
  } catch (e) {
    console.error("[email-queue]", e instanceof Error ? e.message : e);
  }
  return result;
}

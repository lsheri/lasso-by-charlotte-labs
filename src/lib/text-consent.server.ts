/**
 * 19 Nov 2026: storing one agreement to receive text messages. Called only by recordTextConsentFn, from the public
 * page at /texts, by a person who is not signed in.
 *
 * Privacy floor: the name and number go into message_consents and nowhere else. Nothing here records an event,
 * and the one log line carries a database error code only: a Postgres error's message and details quote the row
 * ("Key (phone_e164)=(+1...) already exists"), so they are never logged or returned.
 */
import { createRateLimiter } from "@/lib/activation-keys";
import {
  checkTextConsent,
  TEXT_CONSENT_VERSION,
  TEXT_CONSENT_WORDING,
  type TextConsentRecord,
  type TextConsentResult,
} from "@/lib/text-consent-shared";

export type ConsentRow = {
  org_id: string | null;
  full_name: string;
  phone_e164: string;
  consent_text: string;
  consent_version: string;
  source: "public_page";
};

export type ConsentStore = {
  /** Whether a workspace with this id exists. A failed read is "no". */
  workspaceExists(id: string): Promise<boolean>;
  /** "already": this number has a live agreement on file. "failed": nothing was written. */
  insert(row: ConsentRow): Promise<"stored" | "already" | "failed">;
};

export type ConsentDeps = {
  store: ConsentStore;
  /** False when this caller, or everyone together, has pressed too often. */
  allow(clientKey: string): boolean;
  clientKey: string;
};

export function consentRow(record: TextConsentRecord, orgId: string | null): ConsentRow {
  return {
    org_id: orgId,
    full_name: record.name,
    phone_e164: record.phone,
    consent_text: TEXT_CONSENT_WORDING,
    consent_version: TEXT_CONSENT_VERSION,
    source: "public_page",
  };
}

/**
 * The whole decision, with its edges passed in so it can be tested without a database. The answer is the same
 * whether the number is new or already on file, and whether the link's workspace exists or not, so the page can
 * never be used to ask "is this number known?" or "is this a real workspace?".
 */
export async function recordTextConsent(
  input: unknown,
  deps: ConsentDeps,
): Promise<TextConsentResult> {
  if (!deps.allow(deps.clientKey)) return { ok: false, reason: "busy" };
  const check = checkTextConsent(input as Parameters<typeof checkTextConsent>[0]);
  if (!check.ok) return { ok: false, reason: "invalid", problems: check.problems };
  try {
    const { record } = check;
    // A link can name a workspace. One that does not exist is dropped, and the agreement is still kept.
    const orgId =
      record.workspace && (await deps.store.workspaceExists(record.workspace))
        ? record.workspace
        : null;
    const outcome = await deps.store.insert(consentRow(record, orgId));
    return outcome === "failed" ? { ok: false, reason: "unavailable" } : { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

// Best effort, held in this module's memory: per instance, reset on redeploy. Five presses per ten minutes from one
// address, and 120 an hour from everyone, so a script cannot fill the table. A durable limit needs a table.
const perClient = createRateLimiter(5, 10 * 60_000);
const everyone = createRateLimiter(120, 60 * 60_000);
export function allowConsentAttempt(clientKey: string, now: number = Date.now()): boolean {
  return perClient(clientKey, now) && everyone("all", now);
}

type LooseTable = {
  select(columns: string): {
    eq(
      column: string,
      value: string,
    ): { maybeSingle(): Promise<{ data: unknown; error: unknown }> };
  };
  insert(row: ConsentRow): Promise<{ error: { code?: string } | null }>;
};

/** The real store: the service-role client, the only role that can touch message_consents. */
async function supabaseStore(): Promise<ConsentStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // message_consents is newer than the generated types.
  const from = (table: string) =>
    (supabaseAdmin as unknown as { from(name: string): LooseTable }).from(table);
  return {
    async workspaceExists(id) {
      const { data, error } = await from("orgs").select("id").eq("id", id).maybeSingle();
      return !error && !!data;
    },
    async insert(row) {
      // No .select(): the row is never read back.
      const { error } = await from("message_consents").insert(row);
      if (!error) return "stored";
      // 23505: the one-live-agreement-per-number index. The person has already agreed.
      if (error.code === "23505") return "already";
      console.error(
        `[text-consent] insert failed, code ${typeof error.code === "string" ? error.code : "unknown"}`,
      );
      return "failed";
    },
  };
}

/** The caller's network address, used only as the rate limiter's key in memory. Never stored, never logged. */
async function clientKey(): Promise<string> {
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const forwarded =
      getRequestHeader("cf-connecting-ip") ??
      getRequestHeader("x-forwarded-for")?.split(",")[0]?.trim();
    return forwarded || "unknown";
  } catch {
    return "unknown";
  }
}

export async function handleTextConsent(input: unknown): Promise<TextConsentResult> {
  try {
    return await recordTextConsent(input, {
      store: await supabaseStore(),
      allow: allowConsentAttempt,
      clientKey: await clientKey(),
    });
  } catch {
    // For example the service key is missing on this machine. Say so plainly; never pretend it saved.
    return { ok: false, reason: "unavailable" };
  }
}

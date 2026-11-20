/**
 * 19 Nov 2026: storing one agreement to receive text messages. Called only by recordTextConsentFn, from the public
 * page at /texts, by a person who is not signed in.
 *
 * Privacy floor: the name and number go into message_consents and nowhere else. Nothing here records an event,
 * and the one log line carries a database error code only: a Postgres error's message and details quote the row
 * ("Key (phone_e164)=(+1...) already exists"), so they are never logged or returned.
 *
 * 19 Nov, the roster: a link can also name one roster person (/texts?w=<workspace>&c=<person>). The agreement is
 * tied to that person only if they are in that workspace, and a person has one live agreement at a time: the first
 * number to agree through their link is theirs until it is stopped. That tie is how an admin picks a person, and
 * the server finds the number, without anyone typing a number into the app.
 *
 * 19 Nov, five firms: the same number can agree in several workspaces, one live agreement in each. A person can
 * replace their number through their own link, but only inside a window an admin or lead opened for them; the swap
 * is one database transaction. A person can stop texts from their own link. `consentRecords` at the end is what the
 * sending and reply code calls: the number for a picked person, STOP for a number, and a number proven by a reply.
 */
import { createRateLimiter } from "@/lib/activation-keys";
import {
  checkTextStop,
  checkTextConsent,
  TEXT_CONSENT_VERSION,
  TEXT_CONSENT_WORDING,
  type TextConsentRecord,
  type TextConsentResult,
  type TextStopResult,
} from "@/lib/text-consent-shared";

/** Why an agreement ended. The database allows these three and nothing else. */
export type RevokeReason = "stop_reply" | "stop_link" | "number_changed";

export type ConsentRow = {
  org_id: string | null;
  /** Present only when the link named a roster person in its own workspace. Left off otherwise. */
  roster_contact_id?: string;
  full_name: string;
  phone_e164: string;
  consent_text: string;
  consent_version: string;
  source: "public_page";
};

export type ConsentStore = {
  /** Whether a workspace with this id exists. A failed read is "no". */
  workspaceExists(id: string): Promise<boolean>;
  /** Whether this roster person is in this workspace. A failed read is "no". */
  contactInWorkspace(workspaceId: string, contactId: string): Promise<boolean>;
  /**
   * "already": this number has a live agreement on file, or this person does. "failed": nothing was written.
   */
  insert(row: ConsentRow): Promise<"stored" | "already" | "failed">;
  /**
   * Ties this number's live agreement to a roster person, only when that agreement names no person yet and no
   * other workspace. Changes nothing otherwise, and never says which.
   */
  attach(phone: string, workspaceId: string, contactId: string): Promise<void>;
  /**
   * Swaps a roster person's number for this one, only while an admin or lead has a change window open for them.
   * One transaction in the database: the old agreement ended, the new one stored, the window closed. Changes
   * nothing otherwise, and never says which.
   */
  replace(row: ConsentRow & { org_id: string; roster_contact_id: string }): Promise<void>;
  /** Ends this person's live agreement for this number in this workspace, if there is one. False: the write failed. */
  stop(phone: string, workspaceId: string, contactId: string): Promise<boolean>;
};

export type ConsentDeps = {
  store: ConsentStore;
  /** False when this caller, or everyone together, has pressed too often. */
  allow(clientKey: string): boolean;
  clientKey: string;
};

export function consentRow(
  record: TextConsentRecord,
  orgId: string | null,
  contactId: string | null = null,
): ConsentRow {
  return {
    org_id: orgId,
    ...(orgId && contactId ? { roster_contact_id: contactId } : {}),
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
    // A link can also name a roster person. One who is not in that workspace is dropped the same way.
    const contactId =
      orgId && record.contact && (await deps.store.contactInWorkspace(orgId, record.contact))
        ? record.contact
        : null;
    const outcome = await deps.store.insert(consentRow(record, orgId, contactId));
    if (outcome === "failed") return { ok: false, reason: "unavailable" };
    // They had already agreed before they had a link of their own: tie that agreement to them. Best effort, and the
    // answer is the same either way.
    if (outcome === "already" && orgId && contactId) {
      await deps.store.attach(record.phone, orgId, contactId).catch(() => undefined);
      // Or this is their new number. It replaces the old one only inside a window an admin or lead opened.
      await deps.store
        .replace({
          ...consentRow(record, orgId, contactId),
          org_id: orgId,
          roster_contact_id: contactId,
        })
        .catch(() => undefined);
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * Stopping from a person's own link. The link names the person; the number they type must be the one on their
 * agreement, so a link in the wrong hands cannot be used to find out a number, and the answer is the same whether
 * anything was stopped or not. It ends the agreement in that one workspace. Replying STOP ends them all.
 */
export async function stopTextConsent(input: unknown, deps: ConsentDeps): Promise<TextStopResult> {
  if (!deps.allow(deps.clientKey)) return { ok: false, reason: "busy" };
  const check = checkTextStop(input as Parameters<typeof checkTextStop>[0]);
  if (!check.ok) return { ok: false, reason: "invalid" };
  try {
    const { phone, workspace, contact } = check.record;
    // Without a person's link there is nothing here to stop; replying STOP is the way. Same answer.
    if (!workspace || !contact) return { ok: true };
    return (await deps.store.stop(phone, workspace, contact))
      ? { ok: true }
      : { ok: false, reason: "unavailable" };
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

type LooseError = { code?: string } | null;
type LooseFilter = {
  eq(column: string, value: string): LooseFilter;
  in(column: string, values: readonly string[]): LooseFilter;
  limit(count: number): LooseFilter;
  is(column: string, value: null): LooseFilter;
  or(filter: string): LooseFilter;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
  then: Promise<{ error: { code?: string } | null }>["then"];
};
type LooseTable = {
  select(columns: string): LooseFilter;
  insert(row: ConsentRow): Promise<{ error: { code?: string } | null }>;
  update(values: Record<string, string>): LooseFilter;
};
type LooseDb = {
  from(name: string): LooseTable;
  rpc(name: string, args: Record<string, string>): Promise<{ data: unknown; error: LooseError }>;
};

const code = (error: LooseError): string =>
  typeof error?.code === "string" ? error.code : "unknown";
/** A column or function this code needs is not in the database yet (the migration has not been run). */
const notThereYet = (error: LooseError): boolean =>
  ["42703", "PGRST204", "PGRST202", "42883"].includes(code(error));

/** Ends live agreements matching the filter. Works before the reason column exists, without the reason. */
async function endAgreements(
  db: LooseDb,
  reason: RevokeReason,
  narrow: (query: LooseFilter) => LooseFilter,
): Promise<LooseError> {
  const at = new Date().toISOString();
  const first = await narrow(
    db.from("message_consents").update({ revoked_at: at, revoked_reason: reason }),
  ).is("revoked_at", null);
  if (!first.error || !notThereYet(first.error)) return first.error;
  const again = await narrow(db.from("message_consents").update({ revoked_at: at })).is(
    "revoked_at",
    null,
  );
  return again.error;
}

/** The real store: the service-role client, the only role that can touch message_consents. */
async function supabaseStore(): Promise<ConsentStore> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // message_consents is newer than the generated types.
  const db = supabaseAdmin as unknown as LooseDb;
  const from = (table: string) => db.from(table);
  return {
    async replace(row) {
      const { error } = await db.rpc("replace_text_consent", {
        p_org: row.org_id,
        p_contact: row.roster_contact_id,
        p_phone: row.phone_e164,
        p_name: row.full_name,
        p_text: row.consent_text,
        p_version: row.consent_version,
      });
      // 23505: the new number is already another person's in this workspace. Nothing changed.
      if (error && error.code !== "23505" && !notThereYet(error)) {
        console.error(`[text-consent] replace failed, code ${code(error)}`);
      }
    },
    async stop(phone, workspaceId, contactId) {
      const error = await endAgreements(db, "stop_link", (query) =>
        query.eq("phone_e164", phone).eq("org_id", workspaceId).eq("roster_contact_id", contactId),
      );
      if (error) console.error(`[text-consent] stop failed, code ${code(error)}`);
      return !error;
    },
    async workspaceExists(id) {
      const { data, error } = await from("orgs").select("id").eq("id", id).maybeSingle();
      return !error && !!data;
    },
    async contactInWorkspace(workspaceId, contactId) {
      // Fails, and so answers "no", until the roster table exists. The agreement is then stored as before.
      const { data, error } = await from("roster_contacts")
        .select("id")
        .eq("id", contactId)
        .eq("org_id", workspaceId)
        .maybeSingle();
      return !error && !!data;
    },
    async attach(phone, workspaceId, contactId) {
      // Both ids were checked as UUIDs before they reached here. A person who already has a live agreement is
      // refused by the database's one-per-person index, which is the right answer: the first number stays.
      const { error } = await from("message_consents")
        .update({ org_id: workspaceId, roster_contact_id: contactId })
        .eq("phone_e164", phone)
        .is("revoked_at", null)
        .is("roster_contact_id", null)
        .or(`org_id.is.null,org_id.eq.${workspaceId}`);
      if (error && error.code !== "23505") {
        console.error(
          `[text-consent] attach failed, code ${typeof error.code === "string" ? error.code : "unknown"}`,
        );
      }
    },
    async insert(row) {
      // No .select(): the row is never read back.
      const { error } = await from("message_consents").insert(row);
      if (!error) return "stored";
      // 23505: one live agreement per number, and one per roster person. Someone has already agreed.
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

export async function handleTextStop(input: unknown): Promise<TextStopResult> {
  try {
    return await stopTextConsent(input, {
      store: await supabaseStore(),
      allow: allowConsentAttempt,
      clientKey: await clientKey(),
    });
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/* ---------------------------------------------------------------------------
 * For the sending and reply code. Server only. A number goes in or comes out of these and nowhere else: none of
 * them logs one, and only `numberFor` returns one, to be handed straight to the sender.
 * ------------------------------------------------------------------------- */

const E164 = /^\+1[2-9][0-9]{2}[2-9][0-9]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function consentRecords(db: LooseDb) {
  return {
    /**
     * The number a roster person agreed with in this workspace, or null: no live agreement, stopped, an id from
     * another workspace, or a failed read. Never send on null.
     */
    async numberFor(orgId: string, contactId: string): Promise<string | null> {
      if (!UUID.test(orgId) || !UUID.test(contactId)) return null;
      const { data, error } = await db
        .from("message_consents")
        .select("phone_e164")
        .eq("org_id", orgId)
        .eq("roster_contact_id", contactId)
        .is("revoked_at", null)
        .maybeSingle();
      const phone = (data as { phone_e164?: unknown } | null)?.phone_e164;
      return !error && typeof phone === "string" && E164.test(phone) ? phone : null;
    },
    /**
     * A STOP reply: ends every live agreement for this number, in every workspace. "failed" means nothing can be
     * assumed stopped, so do not send to this number.
     */
    async stopNumber(phone: string): Promise<"done" | "failed"> {
      if (!E164.test(phone)) return "failed";
      const error = await endAgreements(db, "stop_reply", (query) => query.eq("phone_e164", phone));
      if (error) console.error(`[text-consent] stop reply failed, code ${code(error)}`);
      return error ? "failed" : "done";
    },
    /**
     * A message arrived from this number, which proves the person holds it: marks its live agreements confirmed.
     * Call it only for a real inbound message from the carrier, never for anything typed into the app.
     */
    async confirmNumber(phone: string): Promise<void> {
      if (!E164.test(phone)) return;
      const { error } = await db
        .from("message_consents")
        .update({ confirmed_at: new Date().toISOString() })
        .eq("phone_e164", phone)
        .is("revoked_at", null)
        .is("confirmed_at", null);
      if (error && !notThereYet(error))
        console.error(`[text-consent] confirm failed, code ${code(error)}`);
    },
  };
}

/** `consentRecords` on the service-role client. */
export async function liveConsentRecords() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return consentRecords(supabaseAdmin as unknown as LooseDb);
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

/**
 * 19 Nov 2026, Proposal Desk: the roster's server side. People a firm works with who have no login.
 *
 * Who: an active member of a company workspace who is an admin or a lead (Liam, D-37). Anyone else gets
 * `allowed: false` on a read and a 403 on a write. Every row is read and written with the service role after that
 * check, and always inside the caller's own workspace: an id from another workspace is "missing", never changed.
 *
 * Privacy floor: whether someone agreed to texts comes from message_consents, read here and nowhere else in the
 * roster. The read asks for three columns, the person it belongs to and two dates. It never asks for the number, so
 * a number cannot reach an answer, a log or the browser from this file. No event is recorded.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  canManageRoster,
  checkRosterContact,
  ROSTER_MAX_CONTACTS,
  rosterLinkPath,
  textsStatus,
  type ConsentMark,
  type RosterAffiliation,
  type RosterContact,
  type RosterFields,
  type RosterList,
  type RosterSaveInput,
  type RosterSaveResult,
} from "@/lib/roster-shared";

export type RosterCaller = { profileId: string; orgId: string; role: string };

export type RosterRow = {
  id: string;
  org_id: string;
  full_name: string;
  role_title: string | null;
  affiliation: string;
  firm_name: string | null;
};

export type ConsentMarkRow = ConsentMark & { roster_contact_id: string };

/** Everything the rules need from outside, so each can be tested without a database. */
export type RosterDeps = {
  /** An active, non-guest member of a company workspace, or a thrown 403. */
  caller: () => Promise<RosterCaller>;
  /** This workspace's people, by name. Null when the read failed. */
  list: (orgId: string) => Promise<RosterRow[] | null>;
  count: (orgId: string) => Promise<number | null>;
  insert: (orgId: string, fields: RosterFields) => Promise<RosterRow | null>;
  /** Changes the row only if it is in this workspace. "missing" when it is not there. */
  update: (
    orgId: string,
    id: string,
    fields: RosterFields,
  ) => Promise<RosterRow | "missing" | null>;
  /** Agreement dates for these people in this workspace. Null when the read failed. Never a number. */
  consents: (orgId: string, contactIds: readonly string[]) => Promise<ConsentMarkRow[] | null>;
};

const COLUMNS = "id, org_id, full_name, role_title, affiliation, firm_name";
/** The only columns the roster ever asks message_consents for. */
export const CONSENT_COLUMNS = "roster_contact_id, agreed_at, revoked_at";

function toContact(row: RosterRow, marks: readonly ConsentMark[] | null): RosterContact {
  const affiliation: RosterAffiliation = row.affiliation === "firm" ? "firm" : "independent";
  return {
    id: row.id,
    name: row.full_name,
    role: row.role_title,
    affiliation,
    firm: affiliation === "firm" ? row.firm_name : null,
    ...textsStatus(marks),
    linkPath: rosterLinkPath(row.org_id, row.id),
  };
}

/** The list. Writes nothing. A person who may not see it gets `allowed: false` and no rows. */
export async function listRoster(deps: RosterDeps): Promise<RosterList> {
  const caller = await deps.caller();
  if (!canManageRoster(caller.role)) return { allowed: false };
  const rows = await deps.list(caller.orgId);
  if (rows === null) throw new Response("Unavailable", { status: 503 });
  // A row from another workspace can never be shown, whatever the read returned.
  const mine = rows.filter((row) => row.org_id === caller.orgId);
  const marks =
    mine.length > 0
      ? await deps
          .consents(
            caller.orgId,
            mine.map((row) => row.id),
          )
          .catch(() => null)
      : [];
  return {
    allowed: true,
    contacts: mine.map((row) =>
      toContact(
        row,
        marks === null ? null : marks.filter((mark) => mark.roster_contact_id === row.id),
      ),
    ),
  };
}

/** Add a person, or correct one. */
export async function saveRosterContact(
  deps: RosterDeps,
  input: RosterSaveInput,
): Promise<RosterSaveResult> {
  const caller = await deps.caller();
  if (!canManageRoster(caller.role)) throw new Response("Forbidden", { status: 403 });
  const check = checkRosterContact(input);
  if (!check.ok) return { ok: false, reason: "invalid", problems: check.problems };
  try {
    if (input.id) {
      const row = await deps.update(caller.orgId, input.id, check.fields);
      if (row === "missing") return { ok: false, reason: "missing" };
      if (!row || row.org_id !== caller.orgId) return { ok: false, reason: "unavailable" };
      const marks = await deps.consents(caller.orgId, [row.id]).catch(() => null);
      return { ok: true, contact: toContact(row, marks) };
    }
    const count = await deps.count(caller.orgId);
    if (count === null) return { ok: false, reason: "unavailable" };
    if (count >= ROSTER_MAX_CONTACTS) return { ok: false, reason: "full" };
    const row = await deps.insert(caller.orgId, check.fields);
    if (!row || row.org_id !== caller.orgId) return { ok: false, reason: "unavailable" };
    // Nobody can have agreed through a link that did not exist until now.
    return { ok: true, contact: toContact(row, []) };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/* ---------------------------------------------------------------------------
 * The real outside world. Kept thin: every rule is above.
 * ------------------------------------------------------------------------- */

export type RosterContext = { supabase: SupabaseClient; userId: string };

const ID_PAGE = 100;

function columns(fields: RosterFields) {
  return {
    full_name: fields.name,
    role_title: fields.role,
    affiliation: fields.affiliation,
    firm_name: fields.firm,
  };
}

function logFailure(what: string, error: { code?: unknown } | null): void {
  // A database error's message can quote a row. The code alone says what went wrong.
  console.error(
    `[roster] ${what} failed, code ${typeof error?.code === "string" ? error.code : "unknown"}`,
  );
}

export async function realDeps(
  context: RosterContext,
  profileId: string | null,
): Promise<RosterDeps> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(
    context.supabase as never,
    context.userId,
    profileId,
  );
  // roster_contacts and message_consents are newer than the generated types.
  const admin = supabaseAdmin as unknown as SupabaseClient;
  const caller: RosterCaller = { profileId: profile.id, orgId: profile.org_id, role: profile.role };
  return {
    caller: async () => caller,
    async list(orgId) {
      const { data, error } = await admin
        .from("roster_contacts")
        .select(COLUMNS)
        .eq("org_id", orgId)
        .order("full_name", { ascending: true })
        .limit(ROSTER_MAX_CONTACTS);
      if (error) {
        logFailure("list", error);
        return null;
      }
      return (data ?? []) as RosterRow[];
    },
    async count(orgId) {
      const { count, error } = await admin
        .from("roster_contacts")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId);
      if (error || typeof count !== "number") {
        logFailure("count", error);
        return null;
      }
      return count;
    },
    async insert(orgId, fields) {
      const { data, error } = await admin
        .from("roster_contacts")
        .insert({ org_id: orgId, ...columns(fields) })
        .select(COLUMNS)
        .maybeSingle();
      if (error || !data) {
        logFailure("insert", error);
        return null;
      }
      return data as RosterRow;
    },
    async update(orgId, id, fields) {
      const { data, error } = await admin
        .from("roster_contacts")
        .update({ ...columns(fields), updated_at: new Date().toISOString() })
        .eq("org_id", orgId)
        .eq("id", id)
        .select(COLUMNS)
        .maybeSingle();
      if (error) {
        logFailure("update", error);
        return null;
      }
      // No row back with no error: the id is not in this workspace.
      return data ? (data as RosterRow) : "missing";
    },
    async consents(orgId, contactIds) {
      const marks: ConsentMarkRow[] = [];
      for (let at = 0; at < contactIds.length; at += ID_PAGE) {
        const { data, error } = await admin
          .from("message_consents")
          .select(CONSENT_COLUMNS)
          .eq("org_id", orgId)
          .in("roster_contact_id", contactIds.slice(at, at + ID_PAGE));
        if (error) {
          logFailure("consent read", error);
          return null;
        }
        marks.push(...((data ?? []) as ConsentMarkRow[]));
      }
      return marks;
    },
  };
}

/** The server functions' handlers. The functions file only wires them up, so these are what the tests call. */
export const rosterHandlers = {
  async list(context: RosterContext, data: { profile_id: string | null }): Promise<RosterList> {
    return listRoster(await realDeps(context, data.profile_id));
  },
  async save(context: RosterContext, data: RosterSaveInput): Promise<RosterSaveResult> {
    return saveRosterContact(await realDeps(context, data.profile_id), data);
  },
};

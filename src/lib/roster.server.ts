/**
 * 19 Nov 2026, Proposal Desk: the roster's server side. People a firm works with who have no login.
 *
 * Who: an active member of a company workspace who is an admin or a lead (Liam, D-37). Anyone else gets
 * `allowed: false` on a read and a 403 on a write. Every row is read and written with the service role after that
 * check, and always inside the caller's own workspace: an id from another workspace is "missing", never changed.
 *
 * Privacy floor: whether someone agreed to texts comes from message_consents, read here and nowhere else in the
 * roster. The read asks for three columns, the person it belongs to and two dates. It never asks for the number, so
 * the agreed number cannot reach an answer, a log or the browser from this file. No event is recorded.
 *
 * Contact details (20 Nov): the number, email and LinkedIn address an admin or lead types live in
 * roster_contact_details, a table the browser roles cannot read. This file is the only one that reads or writes it.
 * The number leaves here masked to its last four digits; the email goes to the email sender and to the admins and
 * leads who see the list. Neither is ever logged. A number typed here is contact information only: the code that
 * sends texts never reads this table, so typing a number can never cause a text.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { EMAIL_PALETTE } from "@/design/email-palette";

import {
  canManageRoster,
  changeOpenUntil,
  checkRosterContact,
  checkRosterDetails,
  maskPhone,
  NUMBER_CHANGE_DAYS,
  ROSTER_MAX_CONTACTS,
  rosterLinkPath,
  textsStatus,
  type ConsentMark,
  type RosterAffiliation,
  type RosterChangeInput,
  type RosterChangeResult,
  type RosterContact,
  type RosterDetails,
  type RosterFields,
  type RosterInviteResult,
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
  /** When this person's link stops accepting a new number. Absent before that column exists. */
  number_change_until?: string | null;
};

export type ConsentMarkRow = ConsentMark & { roster_contact_id: string };

/** One person's contact details as stored. Only this file sees the full number. */
export type DetailRow = {
  roster_contact_id: string;
  phone_e164: string;
  email: string;
  linkedin_url: string | null;
  invite_sent_at: string | null;
};

/** What the email to a roster person needs. The sender gets the address and nothing else about them. */
export type RosterInviteMail = { to: string; name: string; workspace: string; link: string };

/** The least time between two emails of the same link to the same person. */
export const INVITE_GAP_MS = 10 * 60_000;

/** Everything the rules need from outside, so each can be tested without a database. */
export type RosterDeps = {
  /** An active, non-guest member of a company workspace, or a thrown 403. */
  caller: () => Promise<RosterCaller>;
  /** This workspace's people, by name. Null when the read failed. */
  list: (orgId: string) => Promise<RosterRow[] | null>;
  /**
   * Adds a person with their details, or corrects one, in one transaction. `id` null adds. `details` null leaves the
   * details alone. Answers the person's id, or why nothing was written. "absent" means the database has no place for
   * details yet; null means the write failed.
   */
  saveAll: (
    orgId: string,
    id: string | null,
    fields: RosterFields,
    details: RosterDetails | null,
  ) => Promise<{ id: string } | "missing" | "full" | "details" | "absent" | null>;
  /** Contact details for these people in this workspace. "absent" before the table exists; null when the read failed. */
  details: (orgId: string, contactIds: readonly string[]) => Promise<DetailRow[] | "absent" | null>;
  /** Ids of people whose agreed number is not the one on file. Worked out in the database; null when not known. */
  differs: (orgId: string) => Promise<string[] | null>;
  workspaceName: (orgId: string) => Promise<string | null>;
  /** Emails one person their link. "not_set_up" while no sending service is wired. Never throws a detail. */
  sendInvite: (mail: RosterInviteMail) => Promise<"sent" | "not_set_up" | "failed">;
  markInvited: (orgId: string, id: string, at: string) => Promise<boolean>;
  /** Changes the row only if it is in this workspace. "missing" when it is not there. */
  update: (
    orgId: string,
    id: string,
    fields: RosterFields,
  ) => Promise<RosterRow | "missing" | null>;
  /** Opens the window for one new number, only on a row in this workspace. "missing" when it is not there. */
  openChange: (orgId: string, id: string, until: string) => Promise<RosterRow | "missing" | null>;
  /** One person, only if they are in this workspace. Null when the read failed. */
  one: (orgId: string, id: string) => Promise<RosterRow | "missing" | null>;
  /** Agreement dates for these people in this workspace. Null when the read failed. Never a number. */
  consents: (orgId: string, contactIds: readonly string[]) => Promise<ConsentMarkRow[] | null>;
};

const BASE_COLUMNS = "id, org_id, full_name, role_title, affiliation, firm_name";
const COLUMNS = `${BASE_COLUMNS}, number_change_until`;
/** The only columns the roster ever asks message_consents for: the person and three dates. */
export const CONSENT_COLUMNS = "roster_contact_id, agreed_at, revoked_at, confirmed_at";
const BASE_CONSENT_COLUMNS = "roster_contact_id, agreed_at, revoked_at";

const dayOf = (value: string | null | undefined): string | null =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;

/**
 * What is known about one person's details. `detail` undefined means "not known" (the table is not there yet, or
 * the read failed): then nobody is marked as needing details on a guess.
 */
type Extra = { detail: DetailRow | null | undefined; differs: boolean };
const NOT_KNOWN: Extra = { detail: undefined, differs: false };

function toContact(
  row: RosterRow,
  marks: readonly ConsentMark[] | null,
  now: Date = new Date(),
  extra: Extra = NOT_KNOWN,
): RosterContact {
  const affiliation: RosterAffiliation = row.affiliation === "firm" ? "firm" : "independent";
  return {
    id: row.id,
    name: row.full_name,
    role: row.role_title,
    affiliation,
    firm: affiliation === "firm" ? row.firm_name : null,
    ...textsStatus(marks),
    changeUntil: changeOpenUntil(row.number_change_until, now),
    linkPath: rosterLinkPath(row.org_id, row.id),
    // The full number stops here.
    phoneMasked: maskPhone(extra.detail?.phone_e164),
    email: extra.detail?.email ?? null,
    linkedin: extra.detail?.linkedin_url ?? null,
    needsDetails: extra.detail === null,
    numberDiffers: extra.detail ? extra.differs : false,
    invitedOn: dayOf(extra.detail?.invite_sent_at),
  };
}

/** One person's details and whether their agreed number differs, read fresh. */
async function extraFor(deps: RosterDeps, orgId: string, id: string): Promise<Extra> {
  const [details, differs] = await Promise.all([
    deps.details(orgId, [id]).catch(() => null),
    deps.differs(orgId).catch(() => null),
  ]);
  if (details === null || details === "absent") return NOT_KNOWN;
  return {
    detail: details.find((d) => d.roster_contact_id === id) ?? null,
    differs: (differs ?? []).includes(id),
  };
}

/** The email assets the workspace invite uses (Resend template invite-member), so this email looks like it. */
const EMAIL_ASSETS = "https://oksycelinhrffzabdguy.supabase.co/storage/v1/object/public/email-assets/lasso-email-assets-r2";

/**
 * The words and look of the agreement email (20 Nov 2026, QA of PR 288 M1): the same shell as the workspace invite,
 * with the Lasso lockup (the lime thread), the rule, one button and the footer. Friendly, no em dashes, and the
 * sending service is never named. Every typed value is escaped; the subject has no line breaks.
 */
export function rosterInviteEmail(mail: Omit<RosterInviteMail, "to">): {
  subject: string;
  text: string;
  html: string;
} {
  const C = EMAIL_PALETTE;
  const esc = (value: string) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const workspace = mail.workspace.replace(/[\r\n]+/g, " ").trim();
  const intro = `${workspace} uses Lasso to run its proposals and projects, and would like to text you about the ones you help with.`;
  const how = "To agree, open your link and enter your own mobile number. It takes a minute.";
  const notYet = "If you would rather not get texts, do nothing. No text is sent unless you agree.";
  const lines = [`Hello ${mail.name},`, intro, how, mail.link, notYet, `Sent by Lasso for ${workspace}.`];
  const body = `font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:26px;color:${C.body};`;
  const small = `font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:${C.quiet};`;
  const rule = `<tr><td style="padding-bottom:22px;font-size:0;line-height:0;"><img src="${EMAIL_ASSETS}/nb-rule-frontdoor.png" width="300" height="10" alt="" border="0" style="display:block;border:0;width:300px;height:10px;" /></td></tr>`;
  const link = esc(mail.link);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>Texts about proposals you help with</title>
</head>
<body style="margin:0;padding:0;background-color:${C.page};">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">${esc(intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.page}" style="background-color:${C.page};">
<tr><td align="center" style="padding:36px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;">
<tr><td style="padding-bottom:28px;font-size:0;line-height:0;"><img src="${EMAIL_ASSETS}/lockup-clear.gif" width="194" height="73" alt="Lasso by Charlotte Labs" border="0" style="display:block;border:0;width:194px;height:73px;" /></td></tr>
<tr><td style="padding-bottom:10px;font-family:Georgia,'Times New Roman',Times,serif;font-size:28px;line-height:35px;color:${C.heading};">Texts about proposals you help with</td></tr>
${rule}
<tr><td style="padding-bottom:16px;${body}">Hello ${esc(mail.name)},</td></tr>
<tr><td style="padding-bottom:16px;${body}">${esc(intro)}</td></tr>
<tr><td style="padding-bottom:16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:${C.body};">${esc(how)}</td></tr>
<tr><td style="padding-top:6px;padding-bottom:18px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.body}" style="background-color:${C.body};border-radius:6px;"><a href="${link}" style="display:block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;color:${C.page};text-decoration:none;font-weight:bold;">Open your link</a></td></tr></table></td></tr>
<tr><td style="padding-bottom:18px;${small}">Or paste this link into your browser:<br /><a href="${link}" style="color:${C.link};text-decoration:underline;word-break:break-all;">${link}</a></td></tr>
<tr><td style="padding-bottom:18px;${small}">${esc(notYet)}</td></tr>
${rule}
<tr><td style="${small}">Sent by Lasso for ${esc(workspace)} &middot; <a href="https://lasso.charlotte-labs.com" style="color:${C.link};text-decoration:underline;">lasso.charlotte-labs.com</a></td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  return {
    subject: `${workspace}: agree to texts about proposals you help with`,
    text: lines.join("\n\n"),
    html,
  };
}

/**
 * An admin or lead asks Lasso to email one person their own agreement link. The email asks; it agrees to nothing.
 * The person still opens the link and enters their own number before any text can go to them.
 */
export async function sendRosterInvite(
  deps: RosterDeps,
  input: RosterChangeInput,
  origin: string,
  now: Date = new Date(),
): Promise<RosterInviteResult> {
  const caller = await deps.caller();
  if (!canManageRoster(caller.role)) throw new Response("Forbidden", { status: 403 });
  if (!input.id) return { ok: false, reason: "missing" };
  try {
    const found = await deps.one(caller.orgId, input.id);
    if (found === "missing") return { ok: false, reason: "missing" };
    if (!found || found.org_id !== caller.orgId) return { ok: false, reason: "unavailable" };
    const details = await deps.details(caller.orgId, [found.id]);
    if (details === null || details === "absent") return { ok: false, reason: "unavailable" };
    const detail = details.find((d) => d.roster_contact_id === found.id);
    if (!detail) return { ok: false, reason: "no_email" };
    const last = detail.invite_sent_at ? Date.parse(detail.invite_sent_at) : NaN;
    if (Number.isFinite(last) && now.getTime() - last < INVITE_GAP_MS)
      return { ok: false, reason: "recent" };
    const workspace =
      (await deps.workspaceName(caller.orgId).catch(() => null)) ?? "A firm you work with";
    const sent = await deps.sendInvite({
      to: detail.email,
      name: found.full_name,
      workspace,
      link: origin + rosterLinkPath(found.org_id, found.id),
    });
    if (sent === "not_set_up") return { ok: false, reason: "not_set_up" };
    if (sent !== "sent") return { ok: false, reason: "unavailable" };
    const at = now.toISOString();
    // The email went. A failed note of the time must not read as a failed send, or it would be sent twice.
    await deps.markInvited(caller.orgId, found.id, at).catch(() => false);
    const [marks, differs] = await Promise.all([
      deps.consents(caller.orgId, [found.id]).catch(() => null),
      deps.differs(caller.orgId).catch(() => null),
    ]);
    return {
      ok: true,
      contact: toContact(found, marks, now, {
        detail: { ...detail, invite_sent_at: at },
        differs: (differs ?? []).includes(found.id),
      }),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/**
 * An admin or lead asks one person for a new number. Nobody types a number here: this only opens a window, a few
 * days long, in which that person's own link accepts one new number and ends the old one. Outside a window the
 * first number stays, so a link passed on later cannot swap it.
 */
export async function requestNumberChange(
  deps: RosterDeps,
  input: RosterChangeInput,
  now: Date = new Date(),
): Promise<RosterChangeResult> {
  const caller = await deps.caller();
  if (!canManageRoster(caller.role)) throw new Response("Forbidden", { status: 403 });
  if (!input.id) return { ok: false, reason: "missing" };
  try {
    const found = await deps.one(caller.orgId, input.id);
    if (found === "missing") return { ok: false, reason: "missing" };
    if (!found || found.org_id !== caller.orgId) return { ok: false, reason: "unavailable" };
    const marks = await deps.consents(caller.orgId, [found.id]).catch(() => null);
    // Nothing to change without a live agreement, and no window is opened on a guess when the read failed.
    if (marks === null) return { ok: false, reason: "unavailable" };
    if (textsStatus(marks).texts !== "agreed") return { ok: false, reason: "not_agreed" };
    const until = new Date(now.getTime() + NUMBER_CHANGE_DAYS * 86_400_000).toISOString();
    const row = await deps.openChange(caller.orgId, found.id, until);
    if (row === "missing") return { ok: false, reason: "missing" };
    if (!row || row.org_id !== caller.orgId) return { ok: false, reason: "unavailable" };
    return {
      ok: true,
      contact: toContact(row, marks, now, await extraFor(deps, caller.orgId, row.id)),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** The list. Writes nothing. A person who may not see it gets `allowed: false` and no rows. */
export async function listRoster(deps: RosterDeps): Promise<RosterList> {
  const caller = await deps.caller();
  if (!canManageRoster(caller.role)) return { allowed: false };
  const rows = await deps.list(caller.orgId);
  if (rows === null) throw new Response("Unavailable", { status: 503 });
  // A row from another workspace can never be shown, whatever the read returned.
  const mine = rows.filter((row) => row.org_id === caller.orgId);
  const ids = mine.map((row) => row.id);
  const [marks, details, differs] =
    ids.length > 0
      ? await Promise.all([
          deps.consents(caller.orgId, ids).catch(() => null),
          deps.details(caller.orgId, ids).catch(() => null),
          deps.differs(caller.orgId).catch(() => null),
        ])
      : [[], [], []];
  const known = details !== null && details !== "absent" ? details : null;
  return {
    allowed: true,
    contacts: mine.map((row) =>
      toContact(
        row,
        marks === null ? null : marks.filter((mark) => mark.roster_contact_id === row.id),
        new Date(),
        known
          ? {
              detail: known.find((d) => d.roster_contact_id === row.id) ?? null,
              differs: (differs ?? []).includes(row.id),
            }
          : NOT_KNOWN,
      ),
    ),
  };
}

/**
 * Add a person, or correct one. An add is refused without a valid mobile number and a valid email. A person from
 * before details were asked for may be corrected with none, and stays marked as needing them.
 */
export async function saveRosterContact(
  deps: RosterDeps,
  input: RosterSaveInput,
): Promise<RosterSaveResult> {
  const caller = await deps.caller();
  if (!canManageRoster(caller.role)) throw new Response("Forbidden", { status: 403 });
  const check = checkRosterContact(input);
  try {
    let hasDetails = false;
    let absent = false;
    if (input.id) {
      const stored = await deps.details(caller.orgId, [input.id]);
      if (stored === null) return { ok: false, reason: "unavailable" };
      absent = stored === "absent";
      hasDetails = !absent && (stored as DetailRow[]).some((d) => d.roster_contact_id === input.id);
    }
    const detailsCheck = checkRosterDetails(input, { adding: !input.id, hasDetails });
    if (!check.ok || !detailsCheck.ok)
      return {
        ok: false,
        reason: "invalid",
        problems: [
          ...(check.ok ? [] : check.problems),
          ...(detailsCheck.ok ? [] : detailsCheck.problems),
        ],
      };
    let saved = absent
      ? ("absent" as const)
      : await deps.saveAll(caller.orgId, input.id, check.fields, detailsCheck.details);
    if (saved === "absent") {
      // The database has no place for details yet. A correction with none still goes through, as it always did;
      // anything that carries details, and every add, waits: nobody is added without them.
      if (!input.id || detailsCheck.details) return { ok: false, reason: "unavailable" };
      const row = await deps.update(caller.orgId, input.id, check.fields);
      if (row === "missing") return { ok: false, reason: "missing" };
      if (!row || row.org_id !== caller.orgId) return { ok: false, reason: "unavailable" };
      saved = { id: row.id };
    }
    if (saved === "missing" || saved === "full") return { ok: false, reason: saved };
    if (saved === "details") return { ok: false, reason: "invalid", problems: ["details"] };
    if (saved === null) return { ok: false, reason: "unavailable" };
    const row = await deps.one(caller.orgId, saved.id);
    if (!row || row === "missing" || row.org_id !== caller.orgId)
      return { ok: false, reason: "unavailable" };
    // Nobody can have agreed through a link that did not exist until now.
    const marks = input.id ? await deps.consents(caller.orgId, [row.id]).catch(() => null) : [];
    return {
      ok: true,
      contact: toContact(row, marks, new Date(), await extraFor(deps, caller.orgId, row.id)),
    };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/* ---------------------------------------------------------------------------
 * The real outside world. Kept thin: every rule is above.
 * ------------------------------------------------------------------------- */

export type RosterContext = { supabase: SupabaseClient; userId: string };

const ID_PAGE = 100;
/** The only columns asked of roster_contact_details. */
export const DETAIL_COLUMNS = "roster_contact_id, phone_e164, email, linkedin_url, invite_sent_at";
/** A table or function the database does not have yet: 42P01 and PGRST205 for a table, PGRST202 and 42883 for a function. */
const NOT_THERE = new Set(["42P01", "PGRST205", "PGRST202", "42883"]);

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
  // Before the number-change column exists, the same read or write runs with the columns that do. A request that
  // names a missing column is refused whole by the database, so the retry never writes twice.
  const withColumns = async <T extends { error: { code?: string } | null }>(
    run: (columns: string) => PromiseLike<T>,
  ): Promise<T> => {
    const first = await run(COLUMNS);
    return first.error?.code === "42703" ? run(BASE_COLUMNS) : first;
  };
  return {
    caller: async () => caller,
    async list(orgId) {
      const { data, error } = await withColumns((columns) =>
        admin
          .from("roster_contacts")
          .select(columns)
          .eq("org_id", orgId)
          .order("full_name", { ascending: true })
          .limit(ROSTER_MAX_CONTACTS),
      );
      if (error) {
        logFailure("list", error);
        return null;
      }
      return (data ?? []) as unknown as RosterRow[];
    },
    async saveAll(orgId, id, fields, details) {
      const { data, error } = await admin.rpc("save_roster_contact", {
        p_org: orgId,
        p_id: id,
        p_name: fields.name,
        p_role: fields.role,
        p_affiliation: fields.affiliation,
        p_firm: fields.firm,
        p_phone: details?.phone ?? null,
        p_email: details?.email ?? null,
        p_linkedin: details?.linkedin ?? null,
        p_max: ROSTER_MAX_CONTACTS,
      });
      if (error) {
        if (NOT_THERE.has(error.code ?? "")) return "absent";
        logFailure("save", error);
        return null;
      }
      if (data === "missing" || data === "full" || data === "details") return data;
      return typeof data === "string" && /^[0-9a-f-]{36}$/.test(data) ? { id: data } : null;
    },
    async details(orgId, contactIds) {
      const rows: DetailRow[] = [];
      for (let at = 0; at < contactIds.length; at += ID_PAGE) {
        const { data, error } = await admin
          .from("roster_contact_details")
          .select(DETAIL_COLUMNS)
          .eq("org_id", orgId)
          .in("roster_contact_id", contactIds.slice(at, at + ID_PAGE));
        if (error) {
          if (NOT_THERE.has(error.code ?? "")) return "absent";
          logFailure("details read", error);
          return null;
        }
        rows.push(...((data ?? []) as unknown as DetailRow[]));
      }
      return rows;
    },
    async differs(orgId) {
      const { data, error } = await admin.rpc("roster_number_differs", { p_org: orgId });
      if (error) {
        if (!NOT_THERE.has(error.code ?? "")) logFailure("number compare", error);
        return null;
      }
      return ((data ?? []) as unknown[]).filter((id): id is string => typeof id === "string");
    },
    async workspaceName(orgId) {
      const { data } = await admin.from("orgs").select("name").eq("id", orgId).maybeSingle();
      const name = (data as { name?: unknown } | null)?.name;
      return typeof name === "string" && name.trim() ? name.trim().slice(0, 120) : null;
    },
    async sendInvite(mail) {
      // The one sender, roster-invite-sender.server.ts.
      return (await import("./roster-invite-sender.server")).sendRosterInviteMail(mail);
    },
    async markInvited(orgId, id, at) {
      const { error } = await admin
        .from("roster_contact_details")
        .update({ invite_sent_at: at })
        .eq("org_id", orgId)
        .eq("roster_contact_id", id);
      if (error) logFailure("invite note", error);
      return !error;
    },
    async update(orgId, id, fields) {
      const { data, error } = await withColumns((selected) =>
        admin
          .from("roster_contacts")
          .update({ ...columns(fields), updated_at: new Date().toISOString() })
          .eq("org_id", orgId)
          .eq("id", id)
          .select(selected)
          .maybeSingle(),
      );
      if (error) {
        logFailure("update", error);
        return null;
      }
      // No row back with no error: the id is not in this workspace.
      return data ? (data as unknown as RosterRow) : "missing";
    },
    async one(orgId, id) {
      const { data, error } = await withColumns((columns) =>
        admin
          .from("roster_contacts")
          .select(columns)
          .eq("org_id", orgId)
          .eq("id", id)
          .maybeSingle(),
      );
      if (error) {
        logFailure("read", error);
        return null;
      }
      return data ? (data as unknown as RosterRow) : "missing";
    },
    async openChange(orgId, id, until) {
      const { data, error } = await admin
        .from("roster_contacts")
        .update({ number_change_until: until })
        .eq("org_id", orgId)
        .eq("id", id)
        .select(COLUMNS)
        .maybeSingle();
      if (error) {
        logFailure("number change", error);
        return null;
      }
      return data ? (data as unknown as RosterRow) : "missing";
    },
    async consents(orgId, contactIds) {
      const marks: ConsentMarkRow[] = [];
      for (let at = 0; at < contactIds.length; at += ID_PAGE) {
        const page = contactIds.slice(at, at + ID_PAGE);
        const read = (columns: string) =>
          admin
            .from("message_consents")
            .select(columns)
            .eq("org_id", orgId)
            .in("roster_contact_id", page);
        let { data, error } = await read(CONSENT_COLUMNS);
        // Before the confirmed date exists, read without it.
        if (error?.code === "42703") ({ data, error } = await read(BASE_CONSENT_COLUMNS));
        if (error) {
          logFailure("consent read", error);
          return null;
        }
        marks.push(...((data ?? []) as unknown as ConsentMarkRow[]));
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
  async askNewNumber(context: RosterContext, data: RosterChangeInput): Promise<RosterChangeResult> {
    return requestNumberChange(await realDeps(context, data.profile_id), data);
  },
  async invite(context: RosterContext, data: RosterChangeInput): Promise<RosterInviteResult> {
    const { CANONICAL_ORIGIN } = await import("./app-host");
    return sendRosterInvite(await realDeps(context, data.profile_id), data, CANONICAL_ORIGIN);
  },
};

/**
 * 20 Nov 2026, Proposal Desk (Liam, D-50): the handlers for a demo workspace's one text number.
 *
 * Every call checks, on the server, that the caller is an admin of a workspace carrying the demo marker. The table
 * has no row rule for any signed-in person, so it is read and written here with the service role only, and its own
 * trigger refuses a row for a workspace that is not a demo.
 *
 * The number goes in and never comes back out: status returns the last two digits and when it was set. It is not
 * put in an event, a log line or an error. The record of who set it and when is the row's own set_by and set_at,
 * plus an event that says only "set" or "cleared".
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import {
  DEMO_NUMBER_COPY,
  demoNumber,
  isDemoWorkspace,
  type DemoNumberProfileInput,
  type DemoNumberResult,
  type DemoNumberSaveInput,
  type DemoNumberStatus,
} from "./demo-text-number-shared";

type Db = SupabaseClient<Database>;
/** The table is not in the generated types until the migration is applied and the types are regenerated. */
type LooseDb = SupabaseClient;

export type DemoNumberCaller = { profileId: string; orgId: string; role: string; userId: string };

export type DemoNumberStore = {
  /** An active, non-guest member of a company workspace, or a thrown 403. */
  caller: () => Promise<DemoNumberCaller>;
  settings: (orgId: string) => Promise<unknown>;
  /** The row's number and when it was set, or null when there is none. Undefined when the read failed. */
  read: (orgId: string) => Promise<{ phone: string; setAt: string | null } | null | undefined>;
  save: (row: { org_id: string; phone_e164: string; person_agreed: true; set_by: string; set_at: string }) => Promise<boolean>;
  clear: (orgId: string) => Promise<boolean>;
  record: (caller: DemoNumberCaller, change: "set" | "cleared") => Promise<void>;
  now: () => Date;
};

async function allowed(store: DemoNumberStore): Promise<DemoNumberCaller | null> {
  const caller = await store.caller();
  if (caller.role !== "admin") return null;
  return isDemoWorkspace(await store.settings(caller.orgId)) ? caller : null;
}

async function statusFor(store: DemoNumberStore, orgId: string): Promise<DemoNumberStatus> {
  const row = await store.read(orgId);
  if (row === undefined) throw new Error("demo_number_unreadable");
  return row ? { show: true, set: true, lastTwo: row.phone.slice(-2), setAt: row.setAt } : { show: true, set: false };
}

/** Whether to draw the card, and whether a number is set. Never the number. */
export async function demoNumberStatus(store: DemoNumberStore): Promise<DemoNumberStatus> {
  const caller = await allowed(store);
  return caller ? statusFor(store, caller.orgId) : { show: false };
}

/** Sets or replaces the number. Refused outside demo workspaces, for anyone but an admin, without the tick, or for a number outside the United States and Canada. */
export async function saveDemoNumber(store: DemoNumberStore, input: DemoNumberSaveInput): Promise<DemoNumberResult> {
  const caller = await allowed(store);
  if (!caller) return { ok: false, problem: DEMO_NUMBER_COPY.problems.notHere };
  if (!input.agreed) return { ok: false, problem: DEMO_NUMBER_COPY.problems.agreed };
  const phone = demoNumber(input.phone);
  if (!phone) return { ok: false, problem: DEMO_NUMBER_COPY.problems.number };
  const now = store.now().toISOString();
  if (!(await store.save({ org_id: caller.orgId, phone_e164: phone, person_agreed: true, set_by: caller.profileId, set_at: now }))) {
    return { ok: false, problem: DEMO_NUMBER_COPY.problems.failed };
  }
  try {
    await store.record(caller, "set");
  } catch {
    /* the number is saved; a recording fault never undoes it */
  }
  return { ok: true, status: { show: true, set: true, lastTwo: phone.slice(-2), setAt: now } };
}

export async function clearDemoNumber(store: DemoNumberStore): Promise<DemoNumberResult> {
  const caller = await allowed(store);
  if (!caller) return { ok: false, problem: DEMO_NUMBER_COPY.problems.notHere };
  if (!(await store.clear(caller.orgId))) return { ok: false, problem: DEMO_NUMBER_COPY.problems.failed };
  try {
    await store.record(caller, "cleared");
  } catch {
    /* cleared all the same */
  }
  return { ok: true, status: { show: true, set: false } };
}

/**
 * For the send only: the number a demo workspace's text goes to, or null. Never call this from anything that
 * answers a browser.
 */
export async function demoRecipient(admin: Db, orgId: string): Promise<string | null> {
  const { data: org } = await admin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
  if (!isDemoWorkspace(org?.settings)) return null;
  const { data } = await (admin as unknown as LooseDb).from("demo_text_recipients").select("phone_e164, person_agreed").eq("org_id", orgId).maybeSingle();
  const row = data as { phone_e164: string; person_agreed: boolean } | null;
  return row && row.person_agreed === true ? demoNumber(row.phone_e164) : null;
}

/* ---------------------------------------------------------------------------
 * The real outside world.
 * ------------------------------------------------------------------------- */

export type DemoNumberContext = { supabase: Db; userId: string };

export async function realStore(context: DemoNumberContext, profileId: string | null): Promise<DemoNumberStore> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, profileId);
  const caller: DemoNumberCaller = { profileId: profile.id, orgId: profile.org_id, role: profile.role, userId: context.userId };
  const loose = supabaseAdmin as unknown as LooseDb;
  return {
    caller: async () => caller,
    async settings(orgId) {
      const { data } = await supabaseAdmin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      return data?.settings ?? null;
    },
    async read(orgId) {
      const { data, error } = await loose.from("demo_text_recipients").select("phone_e164, set_at").eq("org_id", orgId).maybeSingle();
      if (error) return undefined;
      const row = data as { phone_e164: string; set_at: string | null } | null;
      return row ? { phone: row.phone_e164, setAt: row.set_at } : null;
    },
    async save(row) {
      const { error } = await loose.from("demo_text_recipients").upsert(row, { onConflict: "org_id" });
      return !error;
    },
    async clear(orgId) {
      const { error } = await loose.from("demo_text_recipients").delete().eq("org_id", orgId);
      return !error;
    },
    async record(who, change) {
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabaseAdmin, { eventType: "demo_text_number.changed", orgId: who.orgId, userId: who.userId, profileId: who.profileId, dims: { change } });
    },
    now: () => new Date(),
  };
}

export const demoNumberHandlers = {
  async status(context: DemoNumberContext, data: DemoNumberProfileInput): Promise<DemoNumberStatus> {
    return demoNumberStatus(await realStore(context, data.profile_id));
  },
  async save(context: DemoNumberContext, data: DemoNumberSaveInput): Promise<DemoNumberResult> {
    return saveDemoNumber(await realStore(context, data.profile_id), data);
  },
  async clear(context: DemoNumberContext, data: DemoNumberProfileInput): Promise<DemoNumberResult> {
    return clearDemoNumber(await realStore(context, data.profile_id));
  },
};

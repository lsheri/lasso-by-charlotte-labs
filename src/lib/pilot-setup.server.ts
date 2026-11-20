import {
  cleanPilotInput,
  PILOT_INVITE_DAYS,
  PILOT_SET_UP_KEY,
  sameFirmName,
  type PilotRow,
  type PilotSetupResult,
} from "./pilot-setup-shared";

/**
 * 20 Nov 2026, Phase 2 of the chat pill build: "Set up a pilot". Before this, every pilot was hand-written SQL. One
 * founder-only call now makes a company workspace (clients on, as every company workspace starts) and an invite for
 * its first admin, then emails it. The founder gate runs first and refuses everyone else with 403, whatever their
 * role in any workspace. Plain dependencies in, so every branch is tested without a database.
 */
export type PilotDeps = {
  /** Throws a 403 Response for anyone but a Charlotte Labs founder. */
  gate: () => Promise<void>;
  /** Every company workspace's name, or null when the read failed. */
  companyNames: () => Promise<string[] | null>;
  /** Makes the workspace and returns its id, or null. */
  createOrg: (name: string, setUpAt: string) => Promise<string | null>;
  /** Clients are on for a company workspace from the start; true once they are. */
  ensureClientsOn: (orgId: string) => Promise<boolean>;
  /** An email-bound admin invite; returns its code, or null. */
  createInvite: (orgId: string, email: string, expiresAt: string) => Promise<string | null>;
  /** Removes a workspace this call made, when a later step failed. True only once the workspace row is gone. */
  removeOrg: (orgId: string) => Promise<boolean>;
  sendInvite: (mail: { to: string; code: string; orgName: string }) => Promise<"sent" | "not_configured" | "failed">;
  joinUrl: (code: string) => string;
  record: (orgId: string, emailed: "sent" | "not_configured" | "failed") => Promise<void>;
};

export async function setUpPilot(deps: PilotDeps, input: unknown, now: Date = new Date()): Promise<PilotSetupResult> {
  await deps.gate();
  const clean = cleanPilotInput(input);
  if (!clean.ok) return { ok: false, reason: "invalid", field: clean.field };
  const { firmName, adminEmail } = clean.value;

  const names = await deps.companyNames().catch(() => null);
  if (names === null) return { ok: false, reason: "failed" };
  if (names.some((name) => sameFirmName(name, firmName))) return { ok: false, reason: "exists" };

  const orgId = await deps.createOrg(firmName, now.toISOString()).catch(() => null);
  if (!orgId) return { ok: false, reason: "failed" };

  const expiresAt = new Date(now.getTime() + PILOT_INVITE_DAYS * 86_400_000).toISOString();
  const code = (await deps.ensureClientsOn(orgId).catch(() => false))
    ? await deps.createInvite(orgId, adminEmail, expiresAt).catch(() => null)
    : null;
  if (!code) {
    // Nothing half made is left behind: a workspace nobody can join is removed. If even that fails, say so.
    const removed = await deps.removeOrg(orgId).catch(() => false);
    return { ok: false, reason: removed ? "failed" : "stuck" };
  }

  const emailed = await deps.sendInvite({ to: adminEmail, code, orgName: firmName }).catch(() => "failed" as const);
  await deps.record(orgId, emailed).catch(() => undefined);
  return { ok: true, orgId, orgName: firmName, joinUrl: deps.joinUrl(code), emailed };
}

type Loose = {
  from: (table: string) => any; // eslint-disable-line @typescript-eslint/no-explicit-any
  auth: { admin: { getUserById: (id: string) => Promise<unknown> } };
};

function randomCode(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** The real dependencies: the service-role client, after the founder gate. */
export async function realPilotDeps(userId: string | null | undefined): Promise<PilotDeps> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const admin = supabaseAdmin as unknown as Loose;
  const { requireFounder } = await import("./founder-gate.server");
  const { buildJoinUrl } = await import("./join-link");
  return {
    gate: () => requireFounder(supabaseAdmin, userId),
    async companyNames() {
      const { data, error } = await admin.from("orgs").select("name").eq("settings->>type", "company").limit(5000);
      return error ? null : ((data ?? []) as { name: string }[]).map((row) => row.name);
    },
    async createOrg(name, setUpAt) {
      const { data, error } = await admin
        .from("orgs")
        .insert({ name, settings: { type: "company", [PILOT_SET_UP_KEY]: setUpAt }, signup_source: "direct", clients_enabled: true })
        .select("id")
        .single();
      return error || !data ? null : (data as { id: string }).id;
    },
    async ensureClientsOn(orgId) {
      const { data } = await admin.from("orgs").select("clients_enabled").eq("id", orgId).maybeSingle();
      if ((data as { clients_enabled?: boolean } | null)?.clients_enabled === true) return true;
      const { data: written, error } = await admin.from("orgs").update({ clients_enabled: true }).eq("id", orgId).select("id");
      return !error && (written ?? []).length === 1;
    },
    async createInvite(orgId, email, expiresAt) {
      const code = randomCode();
      const { error } = await admin
        .from("invites")
        .insert({ code, org_id: orgId, invited_role: "admin", created_by: null, email, expires_at: expiresAt });
      return error ? null : code;
    },
    async removeOrg(orgId) {
      await admin.from("invites").delete().eq("org_id", orgId);
      await admin.from("data_consent_ledger").delete().eq("org_id", orgId);
      await admin.from("data_consent_state").delete().eq("org_id", orgId);
      await admin.from("orgs").delete().eq("id", orgId);
      const { data, error } = await admin.from("orgs").select("id").eq("id", orgId).maybeSingle();
      return !error && !data;
    },
    async sendInvite(mail) {
      const { sendInviteEmail } = await import("./invites.server");
      const result = await sendInviteEmail({
        to: mail.to,
        inviterName: "Charlotte Labs",
        code: mail.code,
        orgName: mail.orgName,
        role: "admin",
        orgType: "business",
      });
      return result.reason;
    },
    joinUrl: (code) => buildJoinUrl(code),
    async record(orgId, emailed) {
      const { recordEvent } = await import("./telemetry.server");
      // A system event (no user): the founder is never sent to PostHog as a person in the pilot's workspace,
      // and so never with their email or sign-up source (QA of PR 286, M1). Who set it up is on the founder list.
      await recordEvent(supabaseAdmin, { eventType: "pilot.set_up", orgId, userId: null, dims: { emailed } });
    },
  };
}

/** The workspaces made on this page, newest first, with whether the first admin has joined. Founder only. */
export async function listPilots(userId: string | null | undefined, now: Date = new Date()): Promise<PilotRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { requireFounder } = await import("./founder-gate.server");
  await requireFounder(supabaseAdmin, userId);
  const admin = supabaseAdmin as unknown as Loose;
  const { data: orgs, error } = await admin
    .from("orgs")
    .select("id, name, settings")
    .not(`settings->>${PILOT_SET_UP_KEY}`, "is", null)
    .limit(200);
  if (error) throw new Error("Pilots did not load.");
  const rows = (orgs ?? []) as { id: string; name: string; settings: Record<string, unknown> | null }[];
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const [{ data: invites }, { data: people }] = await Promise.all([
    admin.from("invites").select("org_id, email, expires_at, used_at, revoked_at").in("org_id", ids).eq("invited_role", "admin"),
    admin.from("profiles").select("org_id").in("org_id", ids).is("deactivated_at", null),
  ]);
  return rows
    .map((row): PilotRow => {
      const own = ((invites ?? []) as { org_id: string; email: string | null; expires_at: string; used_at: string | null; revoked_at: string | null }[]).filter(
        (invite) => invite.org_id === row.id,
      );
      const used = own.find((invite) => invite.used_at);
      const open = own.find((invite) => !invite.used_at && !invite.revoked_at && Date.parse(invite.expires_at) > now.getTime());
      const count = ((people ?? []) as { org_id: string }[]).filter((person) => person.org_id === row.id).length;
      return {
        orgId: row.id,
        name: row.name,
        setUpAt: String(row.settings?.[PILOT_SET_UP_KEY] ?? ""),
        inviteEmail: (used ?? open ?? own[0])?.email ?? null,
        joined: Boolean(used) || count > 0,
        invite: used || count > 0 ? "joined" : open ? "open" : own.length ? "expired" : "none",
        people: count,
      };
    })
    .sort((a, b) => b.setUpAt.localeCompare(a.setUpAt));
}

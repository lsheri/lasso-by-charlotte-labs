/**
 * 20 Nov 2026, chat pill PR 3b (D-111): a Member who pastes a brief passes it to the workspace's admins. It lands in
 * each admin's notifications with who sent it, the client if the paste names one we have, and the start of the paste.
 * Only Members pass briefs (admins and leads start the proposal themselves), at most five a day, and nothing is sent
 * outside the app. The event carries how many admins it reached, never the words.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { clientNamedIn, type BriefClient } from "./brief-read-shared";
import {
  BRIEF_PASS_COPY,
  BRIEF_PASS_DAILY_MAX,
  mayStartInChat,
  passExcerpt,
  type BriefAdmins,
  type BriefPassResult,
} from "./pill-proposal-shared";

type Db = SupabaseClient<Database>;
type Caller = { orgId: string; profileId: string; userId: string; role: string; name: string };
export type Notice = {
  recipient_profile_id: string;
  org_id: string;
  kind: "brief_passed";
  section: "needs_you";
  /** The live table allows a fixed list of subject types; the workspace is the subject (QA H1 of PR 296). */
  subject_type: "org";
  subject_id: string;
  group_key: string;
  payload: { by: string; client: string; excerpt: string };
};

export type BriefPassDeps = {
  caller: () => Promise<Caller>;
  /** Active admins of the workspace, by name, never the caller. */
  admins: (orgId: string, except: string) => Promise<{ id: string; name: string }[]>;
  clients: (orgId: string) => Promise<BriefClient[]>;
  /** How many briefs this person passed in the last day. */
  passedToday: (orgId: string, profileId: string, since: Date) => Promise<number>;
  notify: (rows: Notice[]) => Promise<boolean>;
  record: (caller: Caller, dims: Record<string, string>) => Promise<void>;
  now: () => Date;
};

/** Who a Member's brief would go to, for the card's button. Admins and leads are told nobody: they start it. */
export async function briefAdmins(deps: BriefPassDeps): Promise<BriefAdmins> {
  const caller = await deps.caller();
  if (mayStartInChat(caller.role)) return { name: null, count: 0 };
  const admins = await deps.admins(caller.orgId, caller.profileId);
  return { name: admins.length === 1 ? admins[0]!.name : null, count: admins.length };
}

export async function passBrief(deps: BriefPassDeps, text: string): Promise<BriefPassResult> {
  const caller = await deps.caller();
  // Admins and leads start the proposal; passing is for Members only, however the call is made.
  if (mayStartInChat(caller.role)) return { ok: false, problem: BRIEF_PASS_COPY.failed };
  const now = deps.now();
  if (
    (await deps.passedToday(
      caller.orgId,
      caller.profileId,
      new Date(now.getTime() - 86_400_000),
    )) >= BRIEF_PASS_DAILY_MAX
  ) {
    return { ok: false, problem: BRIEF_PASS_COPY.tooMany };
  }
  const admins = await deps.admins(caller.orgId, caller.profileId);
  if (!admins.length) return { ok: false, problem: BRIEF_PASS_COPY.noAdmin };
  const client = clientNamedIn(text, await deps.clients(caller.orgId))?.name ?? "";
  const payload = { by: caller.name || "A teammate", client, excerpt: passExcerpt(text) };
  const rows: Notice[] = admins.map((admin) => ({
    recipient_profile_id: admin.id,
    org_id: caller.orgId,
    kind: "brief_passed",
    section: "needs_you",
    subject_type: "org",
    subject_id: caller.orgId,
    group_key: `brief_passed:${caller.profileId}:${now.getTime()}`,
    payload,
  }));
  if (!(await deps.notify(rows))) return { ok: false, problem: BRIEF_PASS_COPY.failed };
  try {
    await deps.record(caller, {
      admins: admins.length === 1 ? "1" : admins.length <= 5 ? "2-5" : "6+",
    });
  } catch {
    /* it reached them; a recording fault changes nothing */
  }
  return { ok: true, admins: admins.length };
}

export type BriefPassContext = { supabase: Db; userId: string };

export async function realBriefPassDeps(
  context: BriefPassContext,
  profileId: string | null,
): Promise<BriefPassDeps> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(
    context.supabase,
    context.userId,
    profileId,
  );
  const admin = supabaseAdmin as unknown as SupabaseClient;
  const { data: me } = await admin
    .from("profiles")
    .select("display_name")
    .eq("id", profile.id)
    .maybeSingle();
  const caller: Caller = {
    orgId: profile.org_id,
    profileId: profile.id,
    userId: context.userId,
    role: String(profile.role ?? ""),
    name: String((me as { display_name?: string | null } | null)?.display_name ?? "").trim(),
  };
  return {
    caller: async () => caller,
    async admins(orgId, except) {
      const { data } = await admin
        .from("profiles")
        .select("id, display_name, role, is_guest, deactivated_at")
        .eq("org_id", orgId)
        .eq("role", "admin")
        .is("deactivated_at", null)
        .limit(50);
      return (
        (data ?? []) as { id: string; display_name: string | null; is_guest: boolean | null }[]
      )
        .filter((row) => row.id !== except && !row.is_guest)
        .map((row) => ({ id: row.id, name: (row.display_name ?? "").trim() }))
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async clients(orgId) {
      const { data } = await context.supabase
        .from("clients")
        .select("id, name, kind, quick_folder")
        .eq("org_id", orgId)
        .is("archived_at", null)
        .limit(1000);
      return (
        (data ?? []) as {
          id: string;
          name: string;
          kind: string | null;
          quick_folder: boolean | null;
        }[]
      )
        .filter((row) => row.kind === "client" && !row.quick_folder)
        .map((row) => ({ id: row.id, name: row.name }));
    },
    async passedToday(orgId, from, since) {
      // One notice per admin per pass, all with the same group key; count distinct passes.
      const { data } = await admin
        .from("notifications")
        .select("group_key")
        .eq("org_id", orgId)
        .eq("kind", "brief_passed")
        .like("group_key", `brief_passed:${from}:%`)
        .gte("created_at", since.toISOString())
        .limit(500);
      return new Set(((data ?? []) as { group_key: string | null }[]).map((row) => row.group_key))
        .size;
    },
    async notify(rows) {
      const { error } = await admin.from("notifications").insert(rows);
      return !error;
    },
    async record(who, dims) {
      const { recordEvent } = await import("./telemetry.server");
      await recordEvent(supabaseAdmin, {
        eventType: "proposal_brief.passed",
        orgId: who.orgId,
        userId: who.userId,
        profileId: who.profileId,
        dims,
      });
    },
    now: () => new Date(),
  };
}

export const briefPassHandlers = {
  async admins(
    context: BriefPassContext,
    data: { profile_id: string | null },
  ): Promise<BriefAdmins> {
    return briefAdmins(await realBriefPassDeps(context, data.profile_id));
  },
  async pass(
    context: BriefPassContext,
    data: { profile_id: string | null; text: string },
  ): Promise<BriefPassResult> {
    return passBrief(await realBriefPassDeps(context, data.profile_id), data.text);
  },
};

/**
 * 19 Nov, Proposal Desk, first live slice (Liam, D-37 and D-39): "Text the lead" on a won proposal board.
 *
 * No flag sits in front of it. What decides whether a workspace has the button is whether it has someone who agreed
 * to be texted. Today that is demo workspaces only (Liam, D-50): an admin of a workspace carrying the demo marker
 * types the one number on the Proposals page and ticks that the person agreed. Every other workspace is answered
 * `show: false` and refused on a direct call, before any send; real workspaces will send only to a person who agreed
 * on the public page with their own number. Until a number and an approved sender are both set, the demo
 * workspace's admins see the words and a press answers that nothing was sent (Liam, D-40).
 *
 * Order of a press: who is asking, which workspace, is the board theirs and won, is there someone to text, record the
 * press, count today's presses, send, record what happened. If the press cannot be recorded nothing is sent, so the
 * daily limit can never be passed by a recording fault.
 *
 * The number is read on the server inside `recipient` and handed straight to the sender. It is never returned,
 * logged or put in an event.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { launchBrand } from "@/design/brand/brand";
import type { Database } from "@/integrations/supabase/types";

import { textConfig, type TextConfig, type TextSendResult } from "./text-sender.server";
import {
  isE164,
  WON_TEXT_COPY,
  WON_TEXT_DAILY_CAP,
  WON_TEXT_PROBLEMS,
  wonTextBody,
  type WonTextBoardInput,
  type WonTextOutcome,
  type WonTextResult,
  type WonTextSendInput,
  type WonTextStatus,
} from "./won-text-shared";

type Db = SupabaseClient<Database>;

export type WonTextCaller = { profileId: string; orgId: string; role: string; userId: string };

/** Everything the rules need from outside, so each can be tested without a database, a secret or a network. */
export type WonTextDeps = {
  /** An active, non-guest member of a company workspace, or a thrown 403. */
  caller: () => Promise<WonTextCaller>;
  /** The board, only if it is in this workspace. */
  board: (orgId: string, engagementId: string) => Promise<{ archived: boolean; won: boolean } | null>;
  firmName: (orgId: string) => Promise<string>;
  brandName: () => string;
  /** Whether this workspace carries the demo marker. Only demo workspaces have the button today. */
  demo: (orgId: string) => Promise<boolean>;
  /** The one number this workspace may text, or null when none is set. Server only. */
  recipient: (orgId: string) => Promise<string | null>;
  config: () => TextConfig | null;
  recordPress: (caller: WonTextCaller) => Promise<void>;
  recordResult: (caller: WonTextCaller, outcome: WonTextOutcome) => Promise<void>;
  /** Presses recorded for this workspace since the start of the UTC day, or null when the count could not be read. */
  pressesToday: (orgId: string) => Promise<number | null>;
  send: (config: TextConfig, message: { to: string; text: string; idempotencyKey: string }) => Promise<TextSendResult>;
};

type Ready = { caller: WonTextCaller; to: string | null; preview: string };

/** The checks a status read and a send share. Null means "nothing here for this person", whatever the reason. */
async function ready(deps: WonTextDeps, engagementId: string, strict: boolean): Promise<Ready | "not_won" | null> {
  const caller = await deps.caller();
  const allowed = caller.role === "admin" && (await deps.demo(caller.orgId));
  if (!allowed) {
    if (strict) throw new Response("Forbidden", { status: 403 });
    return null;
  }
  const board = await deps.board(caller.orgId, engagementId);
  if (!board) {
    if (strict) throw new Response("Not found", { status: 404 });
    return null;
  }
  if (board.archived) return null;
  if (!board.won) return "not_won";
  const number = await deps.recipient(caller.orgId);
  const preview = wonTextBody({ brandName: deps.brandName(), firmName: await deps.firmName(caller.orgId) });
  return { caller, to: isE164(number) ? number : null, preview };
}

/**
 * Whether to draw the button, and the exact words. Writes nothing and calls no provider. `connected` is true only
 * when an approved sender's settings and the one recipient are both in place; until then the admin still sees the
 * words (Liam, D-40) and a press sends nothing.
 */
export async function wonTextStatus(deps: WonTextDeps, input: WonTextBoardInput): Promise<WonTextStatus> {
  const state = await ready(deps, input.engagement_id, false);
  if (!state || state === "not_won") return { show: false };
  return { show: true, connected: deps.config() !== null && state.to !== null, needsNumber: state.to === null, preview: state.preview };
}

/** One press of Send. */
export async function sendWonText(deps: WonTextDeps, input: WonTextSendInput): Promise<WonTextResult> {
  const state = await ready(deps, input.engagement_id, true);
  if (state === "not_won") return { ok: false, problem: WON_TEXT_COPY.notWon };
  // An archived board, nobody to text, or no sender: one plain line, nothing sent and nothing recorded.
  const config = deps.config();
  if (state && !state.to) return { ok: false, problem: WON_TEXT_COPY.noNumber };
  if (!state || !state.to || !config) return { ok: false, problem: WON_TEXT_COPY.notConnected };
  const to = state.to;

  await deps.recordPress(state.caller);
  const presses = await deps.pressesToday(state.caller.orgId);
  // Zero means this press was not recorded; null means the count could not be read. Either way, do not send.
  if (presses === null || presses < 1) return { ok: false, problem: WON_TEXT_COPY.notRecorded };
  if (presses > WON_TEXT_DAILY_CAP) {
    await deps.recordResult(state.caller, "capped");
    return { ok: false, problem: WON_TEXT_PROBLEMS.capped };
  }

  const sent = await deps.send(config, { to, text: state.preview, idempotencyKey: `won-text/${input.engagement_id}/${input.press_id}` });
  if (sent.outcome === "refused" || sent.outcome === "failed") {
    // A status and a short code only. The recipient, the sender and the words never reach a log.
    console.error(`[won-text] ${sent.outcome} status=${sent.status ?? "none"} code=${sent.outcome === "refused" ? (sent.code ?? "none") : "none"}`);
  }
  await deps.recordResult(state.caller, sent.outcome);
  return sent.outcome === "accepted" ? { ok: true } : { ok: false, problem: WON_TEXT_PROBLEMS[sent.outcome] };
}

/* ---------------------------------------------------------------------------
 * The real outside world. Kept thin: every rule is above.
 * ------------------------------------------------------------------------- */

export function startOfUtcDay(now: Date = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export type WonTextContext = { supabase: Db; userId: string };

export async function realDeps(context: WonTextContext, profileId: string | null): Promise<WonTextDeps> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin: admin } = await requireFirmMember(context.supabase, context.userId, profileId);
  const caller: WonTextCaller = { profileId: profile.id, orgId: profile.org_id, role: profile.role, userId: context.userId };
  const record = async (who: WonTextCaller, eventType: "proposal_text.pressed" | "proposal_text.result", dims: Record<string, string>) => {
    const { recordEvent } = await import("./telemetry.server");
    await recordEvent(admin, { eventType, orgId: who.orgId, userId: who.userId, profileId: who.profileId, dims });
  };
  return {
    caller: async () => caller,
    async board(orgId, engagementId) {
      const { data: row } = await admin.from("engagements").select("id, org_id, archived_at").eq("id", engagementId).maybeSingle();
      if (!row || row.org_id !== orgId) return null;
      const { data: won } = await admin.from("proposal_ledger").select("id").eq("org_id", orgId).eq("engagement_id", engagementId).eq("kind", "won").limit(1);
      return { archived: row.archived_at !== null, won: (won ?? []).length > 0 };
    },
    async firmName(orgId) {
      const { data } = await admin.from("orgs").select("name").eq("id", orgId).maybeSingle();
      return typeof data?.name === "string" ? data.name : "";
    },
    // The brand module is the one source for the product's name.
    brandName: () => launchBrand().name,
    async demo(orgId) {
      const { data } = await admin.from("orgs").select("settings").eq("id", orgId).maybeSingle();
      const { isDemoWorkspace } = await import("./demo-text-number-shared");
      return isDemoWorkspace(data?.settings);
    },
    async recipient(orgId) {
      const { demoRecipient } = await import("./demo-text-number.server");
      return demoRecipient(admin, orgId);
    },
    config: () => textConfig(),
    recordPress: (who) => record(who, "proposal_text.pressed", { channel: "sms" }),
    recordResult: (who, outcome) => record(who, "proposal_text.result", { channel: "sms", outcome }),
    async pressesToday(orgId) {
      // The events table is read only inside telemetry.server.ts, and only as a count.
      const { countEventsSince } = await import("./telemetry.server");
      return countEventsSince(admin, { orgId, eventType: "proposal_text.pressed", since: startOfUtcDay() });
    },
    async send(config, message) {
      const { sendText } = await import("./text-sender.server");
      return sendText(config, message);
    },
  };
}

/** The server functions' handlers. The functions file only wires them up, so these are what the tests call. */
export const wonTextHandlers = {
  async status(context: WonTextContext, data: WonTextBoardInput): Promise<WonTextStatus> {
    return wonTextStatus(await realDeps(context, data.profile_id), data);
  },
  async send(context: WonTextContext, data: WonTextSendInput): Promise<WonTextResult> {
    return sendWonText(await realDeps(context, data.profile_id), data);
  },
};

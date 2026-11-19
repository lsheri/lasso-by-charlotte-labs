/**
 * The proposal ledger, server side (Firm Brain Build Spec step 9). Rules in proposal-ledger-shared.ts.
 *
 * Writes: the database lets only the service role write, so every write here uses the admin client after its own
 * checks. Machine rows (first draft, Red pen run) come from the draft and Red pen server paths with counts taken in
 * code; a retry hits a unique index and is ignored. Human rows (dates, won, lost) and the value come from people who
 * may edit the board.
 *
 * Reads: readValueSoFar uses only the caller's own client, so the database's read rules decide the rows. It never
 * opens the ledger with the admin client, never joins profiles and never returns an owner.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import { runAfterResponse } from "@/lib/background";
import type { ResolvedProfile } from "@/lib/profile-resolve";

import type { ProposalDraft } from "./proposal-draft-shared";
import {
  canSeeLedgerValue,
  canSetLedgerValue,
  checkStepDate,
  draftLedgerCounts,
  isHumanKind,
  LEDGER_COLUMNS,
  LEDGER_COPY,
  LEDGER_VALUE_COLUMNS,
  ledgerAccess,
  parseLedgerAmount,
  redPenLedgerCount,
  stepInstant,
  valueSoFar,
  type BoardValueSoFar,
  type FirmValueSoFar,
  type HumanKind,
  type LedgerBoardInput,
  type LedgerKind,
  type LedgerProfileInput,
  type LedgerRow,
  type LedgerShownInput,
  type LedgerSourceLink,
  type LedgerStepInput,
  type LedgerValueInput,
  type LedgerValueRow,
  type StepResult,
  type ValueResult,
} from "./proposal-ledger-shared";
import type { RedPenClaim } from "./red-pen-shared";
import { canSetFees } from "./sow-terms-shared";

type Db = SupabaseClient<Database>;
type LedgerInsert = Database["public"]["Tables"]["proposal_ledger"]["Insert"];

/** The caller's own client, the admin client behind requireFirmMember, and the resolved profile. */
export type LedgerActor = { userDb: Db; admin: Db; profile: ResolvedProfile };

const UNIQUE_VIOLATION = "23505";
/** The longest a draft or a Red pen run waits for its ledger row. Past this the write carries on in the background. */
export const LEDGER_WAIT_MS = 1_500;
const PAGE = 1_000;
const MAX_PAGES = 10;

/**
 * Runs a ledger write beside the work it records, the way recordUsage runs its telemetry copy: started at once,
 * handed to the host to finish, and waited on only up to a short cap. It never throws and never returns a failure,
 * so a ledger problem cannot fail or hold a draft or a Red pen run.
 */
export async function detachLedger(work: () => Promise<unknown>): Promise<void> {
  let running: Promise<void>;
  try {
    running = Promise.resolve(work()).then(
      () => undefined,
      () => undefined,
    );
  } catch {
    return;
  }
  runAfterResponse(() => running);
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, LEDGER_WAIT_MS);
    void running.then(() => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Insert, or nothing when the row is already there. A unique violation is the "on conflict do nothing" answer. */
async function insertOnce(admin: Db, row: LedgerInsert): Promise<"written" | "already" | "failed"> {
  const { error } = await admin.from("proposal_ledger").insert(row);
  if (!error) return "written";
  return error.code === UNIQUE_VIOLATION ? "already" : "failed";
}

/**
 * A proposal board is a board where a proposal was started: its ledger has a brief or a first draft. Boards have no
 * type of their own, so this is the one definition every write uses.
 */
export async function isProposalBoard(admin: Db, orgId: string, engagementId: string): Promise<boolean> {
  const { data } = await admin
    .from("proposal_ledger")
    .select("id")
    .eq("org_id", orgId)
    .eq("engagement_id", engagementId)
    .in("kind", ["brief_received", "draft_completed"])
    .limit(1);
  return (data ?? []).length > 0;
}

type BoardRow = { id: string; org_id: string; owner_id: string | null; shared_with_firm: boolean; archived_at: string | null };

async function boardRow(admin: Db, engagementId: string): Promise<BoardRow | null> {
  const { data } = await admin.from("engagements").select("id, org_id, owner_id, shared_with_firm, archived_at").eq("id", engagementId).maybeSingle();
  return (data as BoardRow | null) ?? null;
}

async function isEditor(userDb: Db, engagementId: string, profileId: string): Promise<boolean> {
  const { isEngagementEditor } = await import("./canvas-lab.server");
  return isEngagementEditor(userDb, engagementId, profileId);
}

/** The board in the caller's own workspace, with whether they own it or can edit it. Another workspace is "not found". */
async function boardFor(actor: LedgerActor, engagementId: string): Promise<{ board: BoardRow; isOwner: boolean; canEdit: boolean }> {
  const board = await boardRow(actor.admin, engagementId);
  if (!board || board.org_id !== actor.profile.org_id) throw new Response("Not found", { status: 404 });
  const isOwner = board.owner_id === actor.profile.id;
  const canEdit = isOwner || (await isEditor(actor.userDb, engagementId, actor.profile.id));
  return { board, isOwner, canEdit };
}

/* ---------------------------------------------------------------------------
 * Machine rows.
 * ------------------------------------------------------------------------- */

/** The brief's date, written once when the person first sends their brief on. They can correct it afterwards. */
export async function recordBriefReceived(admin: Db, input: { orgId: string; engagementId: string; now?: Date }): Promise<"written" | "already" | "failed"> {
  return insertOnce(admin, { org_id: input.orgId, engagement_id: input.engagementId, kind: "brief_received", occurred_at: (input.now ?? new Date()).toISOString() });
}

/** One row per saved draft, keyed by the draft's item id. Counts come from the saved draft in code. */
export async function recordDraftCompleted(admin: Db, input: { orgId: string; engagementId: string; itemId: string; draft: ProposalDraft }): Promise<"written" | "already" | "failed"> {
  const created = Date.parse(input.draft.createdAt);
  const at = Number.isNaN(created) || created > Date.now() ? new Date() : new Date(created);
  return insertOnce(admin, {
    org_id: input.orgId,
    engagement_id: input.engagementId,
    kind: "draft_completed",
    occurred_at: at.toISOString(),
    source_ref: input.itemId,
    ...draftLedgerCounts(input.draft),
  });
}

/** After a draft is saved: the brief date if none is recorded yet, then the draft row. Detached; never throws. */
export async function ledgerAfterDraft(admin: Db, input: { orgId: string; engagementId: string; itemId: string; draft: ProposalDraft }): Promise<void> {
  await detachLedger(async () => {
    await recordBriefReceived(admin, { orgId: input.orgId, engagementId: input.engagementId });
    await recordDraftCompleted(admin, input);
  });
}

/** When a person sends their brief to find precedents on a board they can edit: the brief date, once. Detached. */
export async function ledgerAfterBrief(actor: LedgerActor, input: { engagementId: string; hasBrief: boolean }): Promise<void> {
  if (!input.hasBrief) return;
  await detachLedger(async () => {
    const { canEdit } = await boardFor(actor, input.engagementId);
    if (!canEdit) return;
    await recordBriefReceived(actor.admin, { orgId: actor.profile.org_id, engagementId: input.engagementId });
  });
}

/**
 * After Red pen finishes: one row per run, only when the deliverable is a proposal on a proposal board. Detached;
 * never throws. The item is read with the caller's own client, so nothing they cannot open is looked at.
 */
export async function ledgerAfterRedPen(actor: LedgerActor, input: { engagementId: string; itemId: string; runId: string; claims: readonly RedPenClaim[] }): Promise<void> {
  await detachLedger(async () => {
    const { data: item } = await actor.userDb.from("work_items").select("id, meta").eq("id", input.itemId).maybeSingle();
    const meta = item?.meta && typeof item.meta === "object" && !Array.isArray(item.meta) ? (item.meta as Record<string, unknown>) : {};
    if (meta["deliverable_kind"] !== "proposal") return;
    if (!(await isProposalBoard(actor.admin, actor.profile.org_id, input.engagementId))) return;
    await insertOnce(actor.admin, {
      org_id: actor.profile.org_id,
      engagement_id: input.engagementId,
      kind: "red_pen_run",
      occurred_at: new Date().toISOString(),
      source_ref: input.runId,
      claims_unsupported: redPenLedgerCount(input.claims),
    });
  });
}

/* ---------------------------------------------------------------------------
 * Human rows.
 * ------------------------------------------------------------------------- */

async function rowsOfKinds(admin: Db, engagementId: string, kinds: readonly LedgerKind[]): Promise<{ id: string; kind: string; occurred_at: string }[]> {
  const { data, error } = await admin.from("proposal_ledger").select("id, kind, occurred_at").eq("engagement_id", engagementId).in("kind", [...kinds]);
  if (error) throw new Response("Could not save.", { status: 500 });
  return data ?? [];
}

/**
 * Records or corrects one dated step. The caller owns the board or can edit it; the date is not in the future; a
 * second outcome is refused in plain words; correcting a date updates the one row.
 */
export async function recordProposalStep(actor: LedgerActor, input: { engagementId: string; kind: unknown; date: unknown; now?: Date }): Promise<StepResult> {
  if (!isHumanKind(input.kind)) return { ok: false, problem: LEDGER_COPY.unknownStep };
  const kind: HumanKind = input.kind;
  const problem = checkStepDate(input.date, input.now);
  if (problem) return { ok: false, problem };
  const { canEdit } = await boardFor(actor, input.engagementId);
  if (!canEdit) throw new Response("Forbidden", { status: 403 });
  const orgId = actor.profile.org_id;
  if (kind !== "brief_received" && !(await isProposalBoard(actor.admin, orgId, input.engagementId))) return { ok: false, problem: LEDGER_COPY.needBrief };

  const occurredAt = stepInstant(input.date as string);
  const outcomeKind = kind === "won" || kind === "lost";
  const other = outcomeKind ? (kind === "won" ? "lost" : "won") : null;
  const save = async (): Promise<StepResult | "raced"> => {
    const existing = await rowsOfKinds(actor.admin, input.engagementId, other ? [kind, other] : [kind]);
    if (other && existing.some((row) => row.kind === other)) return { ok: false, problem: LEDGER_COPY.secondOutcome(other, kind as "won" | "lost") };
    const mine = existing.find((row) => row.kind === kind);
    if (mine) {
      const { error } = await actor.admin.from("proposal_ledger").update({ occurred_at: occurredAt }).eq("id", mine.id).eq("engagement_id", input.engagementId);
      if (error) throw new Response("Could not save.", { status: 500 });
      return { ok: true, row: { id: mine.id, kind, occurred_at: occurredAt } };
    }
    const { data, error } = await actor.admin
      .from("proposal_ledger")
      .insert({ org_id: orgId, engagement_id: input.engagementId, kind, occurred_at: occurredAt })
      .select("id")
      .maybeSingle();
    if (error?.code === UNIQUE_VIOLATION) return "raced";
    if (error || !data) throw new Response("Could not save.", { status: 500 });
    return { ok: true, row: { id: data.id, kind, occurred_at: occurredAt } };
  };
  // Two saves at once (a double click, two tabs): the second finds the first's row and corrects it or is refused.
  const first = await save();
  if (first !== "raced") return first;
  const second = await save();
  if (second === "raced") throw new Response("Could not save.", { status: 500 });
  return second;
}

/** Takes back a step a person recorded. Draft and Red pen rows are never removed by hand. */
export async function removeProposalStep(actor: LedgerActor, input: { engagementId: string; kind: unknown }): Promise<{ ok: true } | { ok: false; problem: string }> {
  if (!isHumanKind(input.kind)) return { ok: false, problem: LEDGER_COPY.unknownStep };
  const { canEdit } = await boardFor(actor, input.engagementId);
  if (!canEdit) throw new Response("Forbidden", { status: 403 });
  const { error } = await actor.admin.from("proposal_ledger").delete().eq("org_id", actor.profile.org_id).eq("engagement_id", input.engagementId).eq("kind", input.kind);
  if (error) throw new Response("Could not save.", { status: 500 });
  return { ok: true };
}

/**
 * "Shown to client" on a proposal deliverable is the sent-to-client date: this copies the earliest showing the
 * database holds into the ledger, once. The date comes from the stored mark, never from the browser. Nothing is
 * recorded when the item is not a proposal, has no showing, or the board has no proposal started.
 */
export async function noteProposalShown(actor: LedgerActor, input: { engagementId: string; itemId: string }): Promise<{ recorded: boolean }> {
  const { canEdit } = await boardFor(actor, input.engagementId);
  if (!canEdit) throw new Response("Forbidden", { status: 403 });
  const { data: item } = await actor.userDb.from("work_items").select("id, meta").eq("id", input.itemId).maybeSingle();
  const meta = item?.meta && typeof item.meta === "object" && !Array.isArray(item.meta) ? (item.meta as Record<string, unknown>) : {};
  if (meta["deliverable_kind"] !== "proposal") return { recorded: false };
  const { data: showings } = await actor.userDb.from("client_showings").select("shown_on").eq("engagement_id", input.engagementId).eq("work_item_id", input.itemId).order("shown_on", { ascending: true }).limit(1);
  const shownOn = (showings ?? [])[0]?.shown_on;
  if (!shownOn || checkStepDate(shownOn) !== null) return { recorded: false };
  if (!(await isProposalBoard(actor.admin, actor.profile.org_id, input.engagementId))) return { recorded: false };
  const wrote = await insertOnce(actor.admin, { org_id: actor.profile.org_id, engagement_id: input.engagementId, kind: "sent_to_client", occurred_at: stepInstant(shownOn) });
  return { recorded: wrote === "written" };
}

/* ---------------------------------------------------------------------------
 * Value.
 * ------------------------------------------------------------------------- */

/** Admins and leads only. The amount is parsed by code with the fee parser; the currency comes from a fixed list. */
export async function setProposalValue(actor: LedgerActor, input: { engagementId: string; amountText: unknown; currency: unknown; clear: boolean }): Promise<ValueResult> {
  if (!canSetFees(actor.profile.role)) throw new Response("Forbidden", { status: 403 });
  const { board, isOwner, canEdit } = await boardFor(actor, input.engagementId);
  if (!canSetLedgerValue({ role: actor.profile.role, isOwner, isEditor: canEdit, shared: board.shared_with_firm, archived: Boolean(board.archived_at) })) throw new Response("Forbidden", { status: 403 });
  const orgId = actor.profile.org_id;
  if (input.clear) {
    const { error } = await actor.admin.from("proposal_ledger_values").delete().eq("org_id", orgId).eq("engagement_id", input.engagementId);
    if (error) throw new Response("Could not save.", { status: 500 });
    return { ok: true, value: null };
  }
  const parsed = parseLedgerAmount(input.amountText, input.currency);
  if (!parsed.ok) return parsed;
  if (!(await isProposalBoard(actor.admin, orgId, input.engagementId))) return { ok: false, problem: LEDGER_COPY.notProposal };
  const { error } = await actor.admin
    .from("proposal_ledger_values")
    .upsert({ engagement_id: input.engagementId, org_id: orgId, amount: parsed.amount, currency: parsed.currency, updated_at: new Date().toISOString() }, { onConflict: "engagement_id" });
  if (error) throw new Response("Could not save.", { status: 500 });
  return { ok: true, value: { amount: parsed.amount, currency: parsed.currency } };
}

/* ---------------------------------------------------------------------------
 * Reads, with the caller's own client only.
 * ------------------------------------------------------------------------- */

async function readLedger(userDb: Db, filter: { orgId: string; engagementId?: string }): Promise<LedgerRow[]> {
  const out: LedgerRow[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = userDb.from("proposal_ledger").select(LEDGER_COLUMNS).eq("org_id", filter.orgId);
    if (filter.engagementId) query = query.eq("engagement_id", filter.engagementId);
    const { data, error } = await query.order("occurred_at", { ascending: true }).order("id", { ascending: true }).range(page * PAGE, page * PAGE + PAGE - 1);
    if (error) throw new Response("Could not load.", { status: 500 });
    const rows = (data ?? []) as unknown as LedgerRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function readValues(userDb: Db, filter: { orgId: string; engagementId?: string }): Promise<LedgerValueRow[]> {
  let query = userDb.from("proposal_ledger_values").select(LEDGER_VALUE_COLUMNS).eq("org_id", filter.orgId);
  if (filter.engagementId) query = query.eq("engagement_id", filter.engagementId);
  const { data, error } = await query.limit(PAGE);
  if (error) throw new Response("Could not load.", { status: 500 });
  return ((data ?? []) as unknown as LedgerValueRow[]).map((row) => ({ engagement_id: row.engagement_id, amount: Number(row.amount), currency: row.currency }));
}

const NO_FIGURES = () => valueSoFar([], null);

/** Where each draft or Red pen row came from, for the rows the reader can open with their own access. */
async function sourceLinks(userDb: Db, rows: readonly LedgerRow[]): Promise<Record<string, LedgerSourceLink>> {
  const drafts = rows.filter((row) => row.kind === "draft_completed" && row.source_ref);
  const runs = rows.filter((row) => row.kind === "red_pen_run" && row.source_ref);
  const itemOfRun = new Map<string, string>();
  if (runs.length) {
    const { data } = await userDb.from("analysis_runs").select("id, scope_id").in("id", runs.map((row) => row.source_ref!));
    for (const run of data ?? []) if (run.scope_id) itemOfRun.set(run.id, run.scope_id);
  }
  const itemIds = [...new Set([...drafts.map((row) => row.source_ref!), ...itemOfRun.values()])];
  if (!itemIds.length) return {};
  const { data: items } = await userDb.from("work_items").select("id, title, display_title").in("id", itemIds);
  const title = new Map((items ?? []).map((item) => [item.id, item.display_title || item.title]));
  const links: Record<string, LedgerSourceLink> = {};
  for (const row of drafts) if (title.has(row.source_ref!)) links[row.id] = { itemId: row.source_ref!, title: title.get(row.source_ref!)!, as: "draft" };
  for (const row of runs) {
    const itemId = itemOfRun.get(row.source_ref!);
    if (itemId && title.has(itemId)) links[row.id] = { itemId, title: title.get(itemId)!, as: "red_pen" };
  }
  return links;
}

/** One proposal's line. A reader the database would show nothing to gets no read at all. */
export async function readBoardValueSoFar(actor: Omit<LedgerActor, "admin">, engagementId: string): Promise<BoardValueSoFar> {
  const { userDb, profile } = actor;
  const { data } = await userDb.from("engagements").select("id, org_id, owner_id, shared_with_firm, archived_at, outcome").eq("id", engagementId).maybeSingle();
  const board = data as (BoardRow & { outcome: string | null }) | null;
  const none: BoardValueSoFar = { scope: "board", access: "none", canEdit: false, canSeeValue: false, canSetValue: false, shared: false, finished: false, figures: NO_FIGURES(), rows: [], sources: {} };
  if (board && board.org_id !== profile.org_id) return none;
  if (!board) {
    // Not on the board, so its row is not theirs to read. An admin or lead still asks the ledger: the database
    // answers with rows only while the board is shared with the firm, and with nothing otherwise.
    if (!canSetFees(profile.role)) return none;
    const rows = await readLedger(userDb, { orgId: profile.org_id, engagementId });
    if (!rows.length) return none;
    const values = await readValues(userDb, { orgId: profile.org_id, engagementId });
    return { ...none, access: "partner", canSeeValue: true, canSetValue: true, shared: true, figures: valueSoFar(rows, values), rows, sources: await sourceLinks(userDb, rows), value: values[0] ? { amount: values[0].amount, currency: values[0].currency } : null };
  }
  const isOwner = board.owner_id === profile.id;
  const editor = isOwner || (await isEditor(userDb, engagementId, profile.id));
  const shared = Boolean(board.shared_with_firm);
  const archived = Boolean(board.archived_at);
  const access = ledgerAccess({ role: profile.role, isOwner, isEditor: editor, shared, archived });
  const canSetValue = canSetLedgerValue({ role: profile.role, isOwner, isEditor: editor, shared, archived });
  if (access === "none") return { ...none, canSetValue, shared };
  const rows = await readLedger(userDb, { orgId: profile.org_id, engagementId });
  const canSeeValue = canSeeLedgerValue(profile.role, access);
  const values = canSeeValue ? await readValues(userDb, { orgId: profile.org_id, engagementId }) : null;
  const result: BoardValueSoFar = {
    scope: "board",
    access,
    canEdit: editor,
    canSeeValue,
    canSetValue,
    shared,
    finished: Boolean(board.outcome?.trim()),
    figures: valueSoFar(rows, values),
    rows,
    sources: await sourceLinks(userDb, rows),
  };
  if (values) result.value = values[0] ? { amount: values[0].amount, currency: values[0].currency } : null;
  return result;
}

/**
 * The firm's line, for admins and leads: every proposal the database shows them, less their own boards that are not
 * shared (the database shows an owner their own rows; the firm's figure counts shared work only).
 */
export async function readFirmValueSoFar(actor: Omit<LedgerActor, "admin">): Promise<FirmValueSoFar> {
  const { userDb, profile } = actor;
  if (!canSetFees(profile.role)) throw new Response("Forbidden", { status: 403 });
  const all = await readLedger(userDb, { orgId: profile.org_id });
  const { data: own, error } = await userDb.from("engagements").select("id, shared_with_firm, archived_at").eq("org_id", profile.org_id).eq("owner_id", profile.id);
  if (error) throw new Response("Could not load.", { status: 500 });
  const notCounted = new Set((own ?? []).filter((board) => !board.shared_with_firm || board.archived_at).map((board) => board.id));
  const rows = all.filter((row) => !notCounted.has(row.engagement_id));
  const values = (await readValues(userDb, { orgId: profile.org_id })).filter((value) => !notCounted.has(value.engagement_id));
  return { scope: "firm", figures: valueSoFar(rows, values), rows };
}

/* ---------------------------------------------------------------------------
 * The server functions' handlers. Each starts with requireFirmMember; the functions file only wires them up.
 * ------------------------------------------------------------------------- */

export type LedgerContext = { supabase: Db; userId: string };

/** Every ledger function starts here: an active member of a company workspace, never a coach or a guest. */
export async function ledgerActorFor(context: LedgerContext, profileId: string | null): Promise<LedgerActor> {
  const { requireFirmMember } = await import("./firm-corpus.server");
  const { profile, supabaseAdmin } = await requireFirmMember(context.supabase, context.userId, profileId);
  return { userDb: context.supabase, admin: supabaseAdmin, profile };
}

export const ledgerHandlers = {
  async boardValueSoFar(context: LedgerContext, data: LedgerBoardInput): Promise<BoardValueSoFar> {
    const { userDb, profile } = await ledgerActorFor(context, data.profile_id);
    return readBoardValueSoFar({ userDb, profile }, data.engagement_id);
  },
  async firmValueSoFar(context: LedgerContext, data: LedgerProfileInput): Promise<FirmValueSoFar> {
    const { userDb, profile } = await ledgerActorFor(context, data.profile_id);
    return readFirmValueSoFar({ userDb, profile });
  },
  async recordProposalStep(context: LedgerContext, data: LedgerStepInput): Promise<StepResult> {
    return recordProposalStep(await ledgerActorFor(context, data.profile_id), { engagementId: data.engagement_id, kind: data.kind, date: data.date });
  },
  async removeProposalStep(context: LedgerContext, data: LedgerStepInput): Promise<{ ok: true } | { ok: false; problem: string }> {
    return removeProposalStep(await ledgerActorFor(context, data.profile_id), { engagementId: data.engagement_id, kind: data.kind });
  },
  async setProposalValue(context: LedgerContext, data: LedgerValueInput): Promise<ValueResult> {
    return setProposalValue(await ledgerActorFor(context, data.profile_id), { engagementId: data.engagement_id, amountText: data.amount_text, currency: data.currency, clear: data.clear });
  },
  async noteProposalShown(context: LedgerContext, data: LedgerShownInput): Promise<{ recorded: boolean }> {
    return noteProposalShown(await ledgerActorFor(context, data.profile_id), { engagementId: data.engagement_id, itemId: data.item_id });
  },
};

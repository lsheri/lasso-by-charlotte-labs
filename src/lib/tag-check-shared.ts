/**
 * The step 5 check on real model output (Firm Brain Build Spec: "on a hand-labelled set of 40 seeded items, the
 * method matches on at least 34"). The demo seed's own labels (itemTags in demo-firm/plan.ts) are the hand labels.
 * This file picks the items and scores the results; the calls run on the deployed site from the QA seed page, because
 * local dev has no AI key. Nothing is written to any item.
 */

import { itemTags, situationCarrier } from "./demo-firm/plan";
import type { DemoBoard, DemoItem } from "./demo-firm/types";
import { nameInRole, type ExtractedTags } from "./extract-tags-shared";

export const TAG_CHECK_ITEMS = 40;
export const TAG_CHECK_CALLS = 12;
export const TAG_CHECK_SITUATIONS = 6;
/** The spec's bar: the method matches on at least this many of the 40. */
export const TAG_CHECK_METHOD_BAR = 34;
/** The spec's bar: cost per item unchanged within this share. */
export const TAG_CHECK_COST_BAR = 0.1;

export type TagCheckCase = {
  boardKey: string;
  itemKey: string;
  title: string;
  type: DemoItem["type"];
  /** True for the 40 method-labelled items; false for the extra SOWs that only check the situation. */
  scored: boolean;
  expected: ExtractedTags;
};

function labelled(item: DemoItem): boolean {
  return Boolean(item.method?.length) && item.placed !== false && item.visibility !== "private";
}

/** Takes items one board at a time, in board order, so the sample spreads across the firm and never changes. */
function spread(boards: readonly DemoBoard[], want: number, pick: (item: DemoItem, board: DemoBoard) => boolean): { board: DemoBoard; item: DemoItem }[] {
  const queues = boards.map((board) => board.items.filter((item) => pick(item, board)).map((item) => ({ board, item })));
  const out: { board: DemoBoard; item: DemoItem }[] = [];
  for (let round = 0; out.length < want && queues.some((queue) => queue.length > round); round += 1) {
    for (const queue of queues) {
      if (out.length >= want) break;
      const entry = queue[round];
      if (entry) out.push(entry);
    }
  }
  return out;
}

/**
 * The fixed sample: 12 calls that name a role and 28 other items, all with a hand-labelled method, then 6 SOWs whose
 * boards carry a situation. Board order, then item order, so two runs check the same items.
 */
export function tagCheckCases(boards: readonly DemoBoard[]): TagCheckCase[] {
  const ordered = [...boards].sort((a, b) => Number(a.key.slice(1)) - Number(b.key.slice(1)));
  const calls = spread(ordered, TAG_CHECK_CALLS, (item) => labelled(item) && item.type === "call" && Boolean(item.role));
  const others = spread(ordered, TAG_CHECK_ITEMS - calls.length, (item) => labelled(item) && item.type !== "call");
  const sows = spread(ordered, TAG_CHECK_SITUATIONS, (item, board) => item.key === "sow" && situationCarrier(board) === "sow");
  const toCase = (scored: boolean) => (entry: { board: DemoBoard; item: DemoItem }): TagCheckCase => ({
    boardKey: entry.board.key,
    itemKey: entry.item.key,
    title: entry.item.title,
    type: entry.item.type,
    scored,
    expected: itemTags(entry.board, entry.item) as ExtractedTags,
  });
  return [...calls.map(toCase(true)), ...others.map(toCase(true)), ...sows.map(toCase(false))];
}

export type TagCheckUsage = { tokensIn: number; tokensOut: number; costUsd: number };

export type TagCheckRaw = { method: string[]; call_role: string | null; stage: string | null; situation: string | null };

const shown = (value: unknown): string | null => (value === null || value === undefined ? null : (typeof value === "string" ? value : JSON.stringify(value)).slice(0, 120));

/** The model's own tag values as short strings, whatever their type, so the report can show them. */
export function rawTags(reply: Record<string, unknown> | null): TagCheckRaw {
  const method = reply?.["method"];
  return {
    method: (Array.isArray(method) ? method : method === null || method === undefined ? [] : [method]).slice(0, 20).map((value) => shown(value) ?? "null"),
    call_role: shown(reply?.["call_role"]),
    stage: shown(reply?.["stage"]),
    situation: shown(reply?.["situation"]),
  };
}

export type TagCheckResult = {
  case: TagCheckCase;
  /** False when the item could not be found or read, or the model's card could not be parsed. */
  ok: boolean;
  note: string | null;
  /** What would be stored: the model's tags after the checks. */
  got: ExtractedTags;
  /** What the model wrote, before any check, so a name or a value outside the list is visible here. */
  raw: TagCheckRaw;
  /** The card call as it is today. */
  before: TagCheckUsage;
  /** The same call with the tags asked for. */
  after: TagCheckUsage;
};

const same = (a: readonly string[] = [], b: readonly string[] = []) => a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");

export type TagCheckReport = {
  items: number;
  failed: number;
  methodExact: number;
  /** At least one method in common: a looser reading, shown beside the exact count, never instead of it. */
  methodOverlap: number;
  methodPass: boolean;
  roles: { matched: number; of: number };
  stages: { matched: number; of: number };
  situations: { matched: number; of: number };
  /** Raw model roles that held a person or client name, and stored roles that did (must be none). */
  namesInRawRoles: string[];
  namesInStoredRoles: string[];
  /** Raw values the model wrote that are not in a list; each was stored as "other" or dropped. */
  outsideList: string[];
  tokens: { beforeIn: number; beforeOut: number; afterIn: number; afterOut: number };
  cost: { beforeUsd: number; afterUsd: number; change: number | null; pass: boolean | null };
};

/** Scores one run. Method, role and stage are scored on the 40; the situation on the extra SOWs. */
export function scoreTagCheck(results: readonly TagCheckResult[], names: readonly string[]): TagCheckReport {
  const scored = results.filter((result) => result.case.scored);
  const done = scored.filter((result) => result.ok);
  const methodExact = done.filter((result) => same(result.got.method, result.case.expected.method)).length;
  const methodOverlap = done.filter((result) => (result.got.method ?? []).some((method) => (result.case.expected.method ?? []).includes(method))).length;
  const withRole = scored.filter((result) => result.case.expected.call_role);
  const withStage = scored.filter((result) => result.case.expected.stage);
  const sows = results.filter((result) => !result.case.scored);
  const all = results.filter((result) => result.ok);
  const sum = (pick: (result: TagCheckResult) => number) => all.reduce((total, result) => total + pick(result), 0);
  const beforeUsd = sum((result) => result.before.costUsd);
  const afterUsd = sum((result) => result.after.costUsd);
  const change = beforeUsd > 0 ? (afterUsd - beforeUsd) / beforeUsd : null;
  const outside: string[] = [];
  for (const result of results) {
    const stored = result.got;
    for (const value of result.raw.method) if (!(stored.method ?? []).includes(value as never)) outside.push(`${result.case.title}: method "${value.slice(0, 40)}"`);
    if (result.raw.call_role !== null && result.raw.call_role !== stored.call_role) outside.push(`${result.case.title}: role "${result.raw.call_role.slice(0, 40)}" stored as ${stored.call_role ?? "nothing"}`);
    if (result.raw.situation !== null && result.raw.situation !== stored.situation && !result.case.scored) outside.push(`${result.case.title}: situation "${result.raw.situation.slice(0, 40)}" stored as ${stored.situation ?? "nothing"}`);
  }
  return {
    items: scored.length,
    failed: results.filter((result) => !result.ok).length,
    methodExact,
    methodOverlap,
    methodPass: methodExact >= TAG_CHECK_METHOD_BAR,
    roles: { matched: withRole.filter((result) => result.ok && result.got.call_role === result.case.expected.call_role).length, of: withRole.length },
    stages: { matched: withStage.filter((result) => result.ok && result.got.stage === result.case.expected.stage).length, of: withStage.length },
    situations: { matched: sows.filter((result) => result.ok && result.got.situation === result.case.expected.situation).length, of: sows.length },
    namesInRawRoles: results.filter((result) => result.raw.call_role !== null && nameInRole(result.raw.call_role, names)).map((result) => result.case.title),
    namesInStoredRoles: results.filter((result) => result.got.call_role && nameInRole(result.got.call_role, names)).map((result) => result.case.title),
    outsideList: outside,
    tokens: {
      beforeIn: sum((result) => result.before.tokensIn),
      beforeOut: sum((result) => result.before.tokensOut),
      afterIn: sum((result) => result.after.tokensIn),
      afterOut: sum((result) => result.after.tokensOut),
    },
    cost: { beforeUsd, afterUsd, change, pass: change === null ? null : change <= TAG_CHECK_COST_BAR },
  };
}

const pct = (value: number) => `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;

/** The report as plain lines, for the QA page and for pasting into a PR. */
export function tagCheckLines(report: TagCheckReport, results: readonly TagCheckResult[]): string[] {
  const read = results.filter((result) => result.ok).length || 1;
  const lines = [
    `Method: exact match on ${report.methodExact} of ${report.items} (bar ${TAG_CHECK_METHOD_BAR}): ${report.methodPass ? "PASS" : "FAIL"}. At least one method in common on ${report.methodOverlap}.`,
    `Role: ${report.roles.matched} of ${report.roles.of} calls. Stage: ${report.stages.matched} of ${report.stages.of} deliverables. Situation: ${report.situations.matched} of ${report.situations.of} SOWs.`,
    `Names in stored roles: ${report.namesInStoredRoles.length} (must be 0): ${report.namesInStoredRoles.length === 0 ? "PASS" : "FAIL"}. Names the model wrote as a role before the check: ${report.namesInRawRoles.length}.`,
    `Values the model wrote that are not a list id: ${report.outsideList.length} (each mapped to its id from its label, stored as "other", or dropped).`,
    `Tokens per item, before: ${Math.round(report.tokens.beforeIn / read)} in, ${Math.round(report.tokens.beforeOut / read)} out. After: ${Math.round(report.tokens.afterIn / read)} in, ${Math.round(report.tokens.afterOut / read)} out.`,
    report.cost.change === null
      ? "Cost: no cost was reported for the calls."
      : `Cost for all items, before: $${report.cost.beforeUsd.toFixed(6)}. After: $${report.cost.afterUsd.toFixed(6)}. Change ${pct(report.cost.change)} (bar +10.0%): ${report.cost.pass ? "PASS" : "FAIL"}.`,
    `Items that could not be read: ${report.failed}.`,
  ];
  for (const result of results) {
    if (!result.ok) lines.push(`  not read: ${result.case.boardKey} ${result.case.title} (${result.note ?? "unknown"})`);
    else if (result.case.scored && !same(result.got.method, result.case.expected.method)) {
      lines.push(`  method differs: ${result.case.boardKey} ${result.case.title}: label ${(result.case.expected.method ?? []).join("+") || "none"}, model ${(result.got.method ?? []).join("+") || "none"}`);
    }
  }
  for (const line of report.outsideList) lines.push(`  outside list: ${line}`);
  return lines;
}

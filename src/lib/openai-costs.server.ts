/**
 * Pass 174: the daily fetch of our own OpenAI spend into ai_costs_daily.
 * Internal ops data: service-role writes only, never user-facing, never sent
 * anywhere. The admin key is read only and is never logged.
 */

import { runAfterResponse } from "./background";
import { createSweepState, releaseSweep, tryStartSweep } from "./sweep-guard";
import {
  costWindow,
  dayKey,
  mapCostBuckets,
  shouldRunToday,
  type CostRow,
  type CostsResponse,
} from "./openai-costs";

export const COSTS_ENDPOINT = "https://api.openai.com/v1/organization/costs";
export const USAGE_ENDPOINT = "https://api.openai.com/v1/organization/usage/completions";

export type CostsSyncResult = {
  status: number | null;
  rows: number;
  projectIds: string[];
  tokensPopulated: boolean;
  error?: string;
};

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** Walks the paged costs endpoint for the window. Stops on any non-200. */
async function fetchCostBuckets(
  key: string,
  now: number,
): Promise<{ status: number; buckets: NonNullable<CostsResponse["data"]> }> {
  const { startTime, endTime } = costWindow(now);
  const buckets: NonNullable<CostsResponse["data"]> = [];
  let page: string | null = null;
  let status = 200;

  for (let i = 0; i < 20; i++) {
    const url = new URL(COSTS_ENDPOINT);
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.append("group_by", "project_id");
    url.searchParams.set("limit", "7");
    if (page) url.searchParams.set("page", page);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    status = response.status;
    if (!response.ok) {
      console.error(`[openai-costs] costs request returned ${status}`);
      return { status, buckets };
    }
    const body = (await response.json()) as CostsResponse;
    buckets.push(...(body.data ?? []));
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return { status, buckets };
}

/**
 * Token counts for the same window, keyed day|project. A refusal here is not
 * fatal: the spend rows still land, the two token fields simply stay empty.
 */
async function fetchTokenTotals(
  key: string,
  now: number,
): Promise<Map<string, { input: number; output: number }>> {
  const totals = new Map<string, { input: number; output: number }>();
  const { startTime, endTime } = costWindow(now);
  let page: string | null = null;

  for (let i = 0; i < 20; i++) {
    const url = new URL(USAGE_ENDPOINT);
    url.searchParams.set("start_time", String(startTime));
    url.searchParams.set("end_time", String(endTime));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.append("group_by", "project_id");
    url.searchParams.set("limit", "7");
    if (page) url.searchParams.set("page", page);

    const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!response.ok) {
      console.warn(`[openai-costs] usage request returned ${response.status}; tokens left empty`);
      return new Map();
    }
    const body = (await response.json()) as UsageResponse;
    for (const bucket of body.data ?? []) {
      if (typeof bucket.start_time !== "number") continue;
      const day = dayKey(bucket.start_time * 1000);
      for (const result of bucket.results ?? []) {
        const mapKey = `${day}|${result.project_id ?? "unattributed"}`;
        const entry = totals.get(mapKey) ?? { input: 0, output: 0 };
        entry.input += result.input_tokens ?? 0;
        entry.output += result.output_tokens ?? 0;
        totals.set(mapKey, entry);
      }
    }
    if (!body.has_more || !body.next_page) break;
    page = body.next_page;
  }
  return totals;
}

type UsageResponse = {
  data?: {
    start_time?: number;
    results?: {
      project_id?: string | null;
      input_tokens?: number | null;
      output_tokens?: number | null;
    }[];
  }[];
  next_page?: string | null;
  has_more?: boolean;
};

async function upsertRows(admin: Admin, rows: CostRow[]): Promise<string | null> {
  if (rows.length === 0) return null;
  const { error } = await admin
    .from("ai_costs_daily")
    .upsert(rows, { onConflict: "day,openai_project_id" });
  return error ? error.message : null;
}

/** One sync. Idempotent: the same day and project always overwrite in place. */
export async function runCostsSync(now: number = Date.now()): Promise<CostsSyncResult> {
  const key = process.env["OPENAI_ADMIN_KEY"];
  if (!key) {
    console.warn("[openai-costs] OPENAI_ADMIN_KEY is not set; nothing fetched.");
    return { status: null, rows: 0, projectIds: [], tokensPopulated: false, error: "no_key" };
  }

  try {
    const { status, buckets } = await fetchCostBuckets(key, now);
    if (status !== 200) {
      return { status, rows: 0, projectIds: [], tokensPopulated: false, error: `http_${status}` };
    }
    const rows = mapCostBuckets({ data: buckets }, new Date(now).toISOString());
    const tokens = await fetchTokenTotals(key, now);
    for (const row of rows) {
      const entry = tokens.get(`${row.day}|${row.openai_project_id}`);
      if (!entry) continue;
      row.input_tokens = entry.input;
      row.output_tokens = entry.output;
    }
    const projectIds = Array.from(new Set(rows.map((r) => r.openai_project_id))).sort();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const failure = await upsertRows(supabaseAdmin as Admin, rows);
    if (failure) {
      console.error("[openai-costs] upsert failed:", failure);
      return { status, rows: 0, projectIds, tokensPopulated: false, error: failure };
    }
    console.log(
      `[openai-costs] status=${status} rows=${rows.length} projects=${projectIds.length}`,
    );
    return {
      status,
      rows: rows.length,
      projectIds,
      tokensPopulated: rows.some((r) => r.input_tokens != null || r.output_tokens != null),
    };
  } catch (e) {
    console.error("[openai-costs] sync failed:", (e as Error).message);
    return {
      status: null,
      rows: 0,
      projectIds: [],
      tokensPopulated: false,
      error: (e as Error).message,
    };
  }
}

const syncState = createSweepState();
let lastRunDay: string | null = null;

/** Test seam. */
export function resetCostsSchedule(): void {
  syncState.lastStartedAt = null;
  syncState.running = false;
  lastRunDay = null;
}

/** Pure-ish view of the daily rule, for the sweep and for tests. */
export function costsSyncDue(now: number): boolean {
  return shouldRunToday(lastRunDay, now) && !syncState.running;
}

/**
 * At most one run per calendar day per instance, never two at once, kept alive
 * past the response. Shares the pass-173 guard module for the overlap rule.
 */
export function scheduleCostsSync(now: number = Date.now()): void {
  if (!shouldRunToday(lastRunDay, now)) return;
  if (!tryStartSweep(syncState, now, 0)) return;
  lastRunDay = dayKey(now);
  runAfterResponse(async () => {
    try {
      await runCostsSync(now);
    } finally {
      releaseSweep(syncState);
    }
  });
}

/** Direct run for the signed hook: same daily rule, awaited. */
export async function runCostsSyncIfDue(now: number = Date.now()): Promise<CostsSyncResult | null> {
  if (!shouldRunToday(lastRunDay, now)) return null;
  if (!tryStartSweep(syncState, now, 0)) return null;
  lastRunDay = dayKey(now);
  try {
    return await runCostsSync(now);
  } finally {
    releaseSweep(syncState);
  }
}

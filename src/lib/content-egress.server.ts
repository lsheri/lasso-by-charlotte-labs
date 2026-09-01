/**
 * The sending half of the full work sync. Reads work items that have never
 * been considered, keeps only those whose workspace chose full openness with
 * the content switch on under the current wording, and posts them signed.
 * Never changes an item beyond its two sync markers.
 */

import { DEFAULT_INGEST_URL, signBody } from "./egress-shared";
import {
  CONTENT_BATCH_SIZE,
  CONTENT_INGEST_PATH,
  planContentBatch,
  type ContentSkipReason,
  type ContentTurn,
  type OrgPosture,
  type WorkItemRow,
  type WorkSample,
} from "./content-egress-shared";
import { computeActorHash } from "./telemetry.server";

export type ContentEgressResult = { sent: number; skipped: number; failed: number };

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

const ITEM_COLUMNS = "id, org_id, owner_id, title, captured_at, created_at_source, meta";

/** The oldest items that have never been considered. */
export async function selectContentPending(admin: Admin): Promise<WorkItemRow[]> {
  const { data, error } = await admin
    .from("work_items")
    .select(ITEM_COLUMNS)
    .is("content_egressed_at", null)
    .is("content_egress_skipped_reason", null)
    .order("captured_at", { ascending: true })
    .limit(CONTENT_BATCH_SIZE);
  if (error) {
    console.error("[content-egress] selectContentPending failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as WorkItemRow[];
}

/** Current org-scope level plus the wording its latest choice was made under. */
async function posturesFor(admin: Admin, orgIds: string[]): Promise<Map<string, OrgPosture>> {
  const postures = new Map<string, OrgPosture>();
  if (orgIds.length === 0) return postures;

  const { data: states } = await admin
    .from("data_consent_state")
    .select("org_id, scope, tier, tier_d_switch, ledger_version")
    .eq("scope", "org")
    .in("org_id", orgIds);
  const { data: orgs } = await admin.from("orgs").select("id, name").in("id", orgIds);
  const { data: ledger } = await admin
    .from("data_consent_ledger")
    .select("org_id, scope, version, consent_text_version")
    .eq("scope", "org")
    .in("org_id", orgIds)
    .order("version", { ascending: true });

  const names = new Map((orgs ?? []).map((row) => [row.id, row.name] as const));
  const latestText = new Map<string, string>();
  for (const row of ledger ?? []) latestText.set(row.org_id, row.consent_text_version);

  for (const row of states ?? []) {
    postures.set(row.org_id, {
      org_id: row.org_id,
      org_name: names.get(row.org_id) ?? null,
      tier: row.tier,
      tier_d_switch: row.tier_d_switch,
      ledger_version: row.ledger_version,
      consent_text_version: latestText.get(row.org_id) ?? null,
    });
  }
  return postures;
}

async function turnsFor(admin: Admin, itemIds: string[]): Promise<Map<string, ContentTurn[]>> {
  const byItem = new Map<string, ContentTurn[]>();
  if (itemIds.length === 0) return byItem;
  const { data } = await admin
    .from("turns")
    .select("work_item_id, turn_no, role, content, ts")
    .in("work_item_id", itemIds)
    .order("turn_no", { ascending: true });
  for (const row of data ?? []) {
    const list = byItem.get(row.work_item_id) ?? [];
    list.push({ turn_no: row.turn_no, role: row.role, content: row.content, ts: row.ts });
    byItem.set(row.work_item_id, list);
  }
  return byItem;
}

/** A short line about the latest analysis run on the item, when there is one. */
async function analysesFor(admin: Admin, itemIds: string[]): Promise<Map<string, string>> {
  const byItem = new Map<string, string>();
  if (itemIds.length === 0) return byItem;
  const { data } = await admin
    .from("analysis_runs")
    .select("scope_id, preset, status, claims_rendered, created_at")
    .in("scope_id", itemIds)
    .order("created_at", { ascending: true });
  for (const row of data ?? []) {
    if (!row.scope_id) continue;
    byItem.set(
      row.scope_id,
      `${row.preset}, ${row.status}, ${row.claims_rendered ?? 0} points rendered`,
    );
  }
  return byItem;
}

async function personKeysFor(
  admin: Admin,
  ownerIds: string[],
): Promise<Map<string, string | null>> {
  const byOwner = new Map<string, string | null>();
  if (ownerIds.length === 0) return byOwner;
  const { data } = await admin.from("profiles").select("id, user_id").in("id", ownerIds);
  for (const row of data ?? []) byOwner.set(row.id, await computeActorHash(row.user_id));
  return byOwner;
}

/**
 * One sweep. Marks items sent only when the console accepted the batch, so a
 * failed post simply leaves them for the next run.
 */
export async function runContentEgress(): Promise<ContentEgressResult> {
  const secret = process.env["LASSO_DATA_INGEST_SECRET"];
  if (!secret) return { sent: 0, skipped: 0, failed: 0 };
  const base = process.env["LASSO_DATA_INGEST_URL"] || DEFAULT_INGEST_URL;
  const url = base.replace(/\/api\/public\/ingest$/, "") + CONTENT_INGEST_PATH;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as Admin;
    const items = await selectContentPending(admin);
    if (items.length === 0) return { sent: 0, skipped: 0, failed: 0 };

    const postures = await posturesFor(admin, Array.from(new Set(items.map((i) => i.org_id))));
    const eligibleIds = items
      .filter((item) => postures.get(item.org_id)?.tier === "d")
      .map((item) => item.id);
    const eligibleItems = items.filter((item) => eligibleIds.includes(item.id));
    const turnsByItem = await turnsFor(admin, eligibleIds);
    const analysisByItem = await analysesFor(admin, eligibleIds);
    const keysByOwner = await personKeysFor(
      admin,
      Array.from(new Set(eligibleItems.map((i) => i.owner_id))),
    );
    const personKeyByItem = new Map<string, string | null>(
      items.map((item) => [item.id, keysByOwner.get(item.owner_id) ?? null]),
    );

    const plan = planContentBatch(items, {
      postures,
      turnsByItem,
      analysisByItem,
      personKeyByItem,
    });

    const sendIds: string[] = [];
    const samples: WorkSample[] = [];
    const skips = new Map<ContentSkipReason, string[]>();
    for (const entry of plan) {
      if (entry.kind === "send") {
        sendIds.push(entry.id);
        samples.push(entry.sample);
      } else {
        const list = skips.get(entry.reason) ?? [];
        list.push(entry.id);
        skips.set(entry.reason, list);
      }
    }

    const skippedCount = Array.from(skips.values()).reduce((n, list) => n + list.length, 0);

    if (samples.length > 0) {
      const body = JSON.stringify({ batch_id: crypto.randomUUID(), samples });
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": await signBody(secret, body),
          "x-timestamp": String(Date.now()),
          "x-nonce": crypto.randomUUID(),
        },
        signal: AbortSignal.timeout(15_000),
        body,
      });
      if (!response.ok) {
        console.error(`[content-egress] post failed: ${response.status} ${await response.text()}`);
        return { sent: 0, skipped: 0, failed: samples.length };
      }
      const now = new Date().toISOString();
      const { error } = await admin
        .from("work_items")
        .update({ content_egressed_at: now })
        .in("id", sendIds);
      if (error) console.error("[content-egress] marking sent items failed:", error.message);
    }

    for (const [reason, ids] of skips) {
      const { error } = await admin
        .from("work_items")
        .update({ content_egress_skipped_reason: reason })
        .in("id", ids);
      if (error) console.error(`[content-egress] marking ${reason} items failed:`, error.message);
    }

    return { sent: samples.length, skipped: skippedCount, failed: 0 };
  } catch (e) {
    console.error("[content-egress] runContentEgress failed:", (e as Error).message);
    return { sent: 0, skipped: 0, failed: 0 };
  }
}

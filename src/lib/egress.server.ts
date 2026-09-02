/**
 * The sending half of the sync to our own data console. Reads rows that have
 * already been stored, decides what may leave each workspace from the level
 * that workspace chose, signs the batch and posts it. Never changes an event.
 */

import {
  DEFAULT_INGEST_URL,
  EGRESS_BATCH_SIZE,
  buildPosture,
  mapEventForEgress,
  shouldRunEgress,
  signBody,
  type CensusEvent,
  type EgressEvent,
  type EgressEventRow,
  type PostureEntry,
  type PostureLedgerRow,
  type PostureStateRow,
} from "./egress-shared";

export type EgressResult = { sent: number; skipped: number; failed: number };

const EVENT_COLUMNS =
  "id, event_uuid, event_type, ts, server_ts, tenant_hash, actor_hash, org_id, schema_version, consent_tier, consent_ledger_version, dims, payload";

type Admin = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

/** The oldest rows that have never been considered. */
export async function selectPending(admin: Admin): Promise<EgressEventRow[]> {
  const { data, error } = await admin
    .from("events")
    .select(EVENT_COLUMNS)
    .is("egressed_at", null)
    .is("egress_skipped_reason", null)
    .order("id", { ascending: true })
    .limit(EGRESS_BATCH_SIZE);
  if (error) {
    console.error("[egress] selectPending failed:", error.message);
    return [];
  }
  return (data ?? []) as unknown as EgressEventRow[];
}

async function orgNamesFor(admin: Admin, orgIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (orgIds.length === 0) return names;
  const { data } = await admin.from("orgs").select("id, name").in("id", orgIds);
  for (const row of data ?? []) names.set(row.id, row.name);
  return names;
}

async function collectPosture(admin: Admin): Promise<PostureEntry[]> {
  try {
    const { data: states } = await admin
      .from("data_consent_state")
      .select("org_id, scope, tier, tier_d_switch, ledger_version, updated_at")
      .eq("scope", "org");
    const { data: ledger } = await admin
      .from("data_consent_ledger")
      .select("org_id, scope, old_tier, new_tier, new_tier_d_switch, version, created_at")
      .eq("scope", "org")
      .order("version", { ascending: true })
      .limit(1000);
    const rows = (states ?? []) as unknown as PostureStateRow[];
    const history = (ledger ?? []) as unknown as PostureLedgerRow[];
    const ids = Array.from(
      new Set([...rows.map((r) => r.org_id), ...history.map((r) => r.org_id)]),
    );
    return buildPosture(rows, history, await orgNamesFor(admin, ids));
  } catch (e) {
    console.error("[egress] posture collection failed:", (e as Error).message);
    return [];
  }
}

/**
 * One sweep. Marks nothing unless the console accepted the batch, so a failed
 * post simply leaves the rows for the next run.
 */
export async function runEgress(): Promise<EgressResult> {
  const secret = process.env["LASSO_DATA_INGEST_SECRET"];
  if (!secret) {
    console.warn("[egress] LASSO_DATA_INGEST_SECRET is not set; nothing sent, rows left pending.");
    return { sent: 0, skipped: 0, failed: 0 };
  }
  const url = process.env["LASSO_DATA_INGEST_URL"] || DEFAULT_INGEST_URL;

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as Admin;
    const rows = await selectPending(admin);
    if (rows.length === 0) return { sent: 0, skipped: 0, failed: 0 };

    // Only the fuller levels carry a workspace name, so only those need a lookup.
    const namedOrgIds = Array.from(
      new Set(
        rows
          .filter((row) => row.consent_tier === "c" || row.consent_tier === "d")
          .map((row) => row.org_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    const orgNames = await orgNamesFor(admin, namedOrgIds);

    const sendIds: number[] = [];
    const events: (EgressEvent | CensusEvent)[] = [];
    const skips = new Map<string, number[]>();
    for (const row of rows) {
      const mapped = mapEventForEgress(row, orgNames);
      if (mapped.kind === "send") {
        sendIds.push(mapped.id);
        events.push(mapped.event);
      } else {
        const list = skips.get(mapped.reason) ?? [];
        list.push(mapped.id);
        skips.set(mapped.reason, list);
      }
    }

    const skippedCount = Array.from(skips.values()).reduce((n, list) => n + list.length, 0);

    if (events.length > 0) {
      const body = JSON.stringify({
        batch_id: crypto.randomUUID(),
        events,
        posture: await collectPosture(admin),
      });
      const timestamp = String(Date.now());
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature": await signBody(secret, body),
          "x-timestamp": timestamp,
          "x-nonce": crypto.randomUUID(),
        },
        signal: AbortSignal.timeout(10_000),
        body,
      });
      if (!response.ok) {
        console.error(`[egress] post failed: ${response.status} ${await response.text()}`);
        return { sent: 0, skipped: 0, failed: events.length };
      }
      const now = new Date().toISOString();
      const { error } = await admin.from("events").update({ egressed_at: now }).in("id", sendIds);
      if (error) console.error("[egress] marking sent rows failed:", error.message);
    }

    for (const [reason, ids] of skips) {
      const { error } = await admin
        .from("events")
        .update({ egress_skipped_reason: reason })
        .in("id", ids);
      if (error) console.error(`[egress] marking ${reason} rows failed:`, error.message);
    }

    return { sent: events.length, skipped: skippedCount, failed: 0 };
  } catch (e) {
    console.error("[egress] runEgress failed:", (e as Error).message);
    return { sent: 0, skipped: 0, failed: 0 };
  }
}

let lastRunAt: number | null = null;
let inFlight = false;

/** Test seam. */
export function resetEgressSchedule(): void {
  lastRunAt = null;
  inFlight = false;
}

/** Fire and forget, at most once a minute per instance. Never blocks a person. */
export function scheduleEgress(): void {
  if (inFlight || !shouldRunEgress(lastRunAt, Date.now())) return;
  lastRunAt = Date.now();
  inFlight = true;
  void runEgress()
    .then(async () => {
      // The work itself only ever moves for workspaces that chose full openness.
      const { runContentEgress } = await import("./content-egress.server");
      await runContentEgress();
    })
    .catch((e) => console.error("[egress] scheduled run failed:", (e as Error).message))
    .finally(() => {
      inFlight = false;
    });
}


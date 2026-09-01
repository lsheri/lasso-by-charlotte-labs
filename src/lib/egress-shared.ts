/**
 * Pure half of the consent-filtered sync to our own data console.
 *
 * Nothing here touches the network or the database. What one workspace shares
 * is decided entirely by the level it chose in "Your data": the lowest level
 * sends nothing at all, the middle levels send counts only, and the fuller
 * levels send work details because that workspace asked for it.
 */

export const DEFAULT_INGEST_URL = "https://lasso-data-console.lovable.app/api/public/ingest";

/** At most one sweep per instance per minute. */
export const EGRESS_DEBOUNCE_MS = 60_000;

/** How many rows one sweep takes. */
export const EGRESS_BATCH_SIZE = 500;

export type EgressEventRow = {
  id: number;
  event_uuid: string | null;
  event_type: string;
  ts: string;
  server_ts?: string | null;
  tenant_hash: string;
  actor_hash: string | null;
  org_id: string | null;
  schema_version: string;
  consent_tier: string | null;
  consent_ledger_version: number | null;
  dims: unknown;
  payload: unknown;
};

export type EgressEvent = {
  event_uuid: string | null;
  event_name: string;
  event_ts: string;
  workspace_ref: string;
  workspace_name?: string | null;
  person_key: string | null;
  consent_tier: string;
  consent_ledger_version: number | null;
  schema_version: string;
  dims: Record<string, unknown>;
};

export type EgressMapped =
  | { kind: "send"; id: number; event: EgressEvent }
  | { kind: "skip"; id: number; reason: string };

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * One stored row becomes either one outbound item or a skip with a reason.
 * `orgNames` supplies the workspace name for the fuller levels only.
 */
export function mapEventForEgress(
  row: EgressEventRow,
  orgNames: Map<string, string> = new Map(),
): EgressMapped {
  const tier = row.consent_tier;
  if (!tier) return { kind: "skip", id: row.id, reason: "unstamped" };
  if (tier === "t0") return { kind: "skip", id: row.id, reason: "t0" };
  if (tier !== "a" && tier !== "b" && tier !== "c" && tier !== "d") {
    return { kind: "skip", id: row.id, reason: "unstamped" };
  }

  const base: EgressEvent = {
    event_uuid: row.event_uuid,
    event_name: row.event_type,
    event_ts: row.ts,
    workspace_ref: row.tenant_hash,
    person_key: null,
    consent_tier: tier,
    consent_ledger_version: row.consent_ledger_version ?? null,
    schema_version: row.schema_version,
    dims: asRecord(row.dims),
  };

  if (tier === "a") return { kind: "send", id: row.id, event: base };

  if (tier === "b") {
    return { kind: "send", id: row.id, event: { ...base, person_key: row.actor_hash } };
  }

  // 'c' and 'd': this workspace chose to share work details or content.
  return {
    kind: "send",
    id: row.id,
    event: {
      ...base,
      workspace_ref: row.org_id ?? row.tenant_hash,
      workspace_name: row.org_id ? (orgNames.get(row.org_id) ?? null) : null,
      person_key: row.actor_hash,
      dims: { ...asRecord(row.dims), ...asRecord(row.payload) },
    },
  };
}

export type PostureEntry = {
  workspace_ref: string;
  workspace_name: string | null;
  scope: string;
  old_tier: string | null;
  new_tier: string;
  tier_d_switch: boolean | null;
  ledger_version: number | null;
  changed_at: string;
};

export type PostureStateRow = {
  org_id: string;
  scope: string;
  tier: string;
  tier_d_switch: boolean | null;
  ledger_version: number | null;
  updated_at: string;
};

export type PostureLedgerRow = {
  org_id: string;
  scope: string;
  old_tier: string | null;
  new_tier: string;
  new_tier_d_switch: boolean | null;
  version: number;
  created_at: string;
};

/** Current org-scope levels plus their history. The console dedupes. */
export function buildPosture(
  states: PostureStateRow[],
  ledger: PostureLedgerRow[],
  orgNames: Map<string, string>,
): PostureEntry[] {
  const fromState: PostureEntry[] = states
    .filter((row) => row.scope === "org")
    .map((row) => ({
      workspace_ref: row.org_id,
      workspace_name: orgNames.get(row.org_id) ?? null,
      scope: "org",
      old_tier: null,
      new_tier: row.tier,
      tier_d_switch: row.tier_d_switch ?? null,
      ledger_version: row.ledger_version ?? null,
      changed_at: row.updated_at,
    }));

  const fromLedger: PostureEntry[] = ledger
    .filter((row) => row.scope === "org")
    .map((row) => ({
      workspace_ref: row.org_id,
      workspace_name: orgNames.get(row.org_id) ?? null,
      scope: "org",
      old_tier: row.old_tier,
      new_tier: row.new_tier,
      tier_d_switch: row.new_tier_d_switch ?? null,
      ledger_version: row.version,
      changed_at: row.created_at,
    }));

  return [...fromState, ...fromLedger];
}

/** Hex HMAC-SHA256 of the raw body, exactly as the console verifies it. */
export async function signBody(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** At most one sweep per window. Returns true when this call may run. */
export function shouldRunEgress(lastRunAt: number | null, now: number): boolean {
  return lastRunAt === null || now - lastRunAt >= EGRESS_DEBOUNCE_MS;
}

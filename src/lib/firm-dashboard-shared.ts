/**
 * Firm view, shared shapes and rules.
 *
 * Every number on this surface is an org aggregate. Nothing here names a
 * person, and the thresholds below exist so a small workspace cannot be read
 * backwards into one. A metric under its floor returns a sentence, never a
 * number.
 */

/** Fewer than this many distinct people and a count is effectively a name. */
export const MIN_ACTORS = 3;
/** Below this the activity panel says so rather than drawing meaning. */
export const MIN_ACTIVITY = 5;
/** Below this the assurance panel says so. */
export const MIN_ASSURANCE_RUNS = 5;
/** Cycle time needs this many accepted pieces of work with both timestamps. */
export const MIN_CYCLE_SAMPLES = 5;

/** A value of null means the metric is suppressed and only the sentence shows. */
export type Stat = { value: number | null; sentence: string };

export function shownStat(value: number, sentence: string): Stat {
  return { value, sentence };
}

export function suppressedStat(sentence: string): Stat {
  return { value: null, sentence };
}

/** Above the floor it is a number with a sentence, below it is the sentence. */
export function gatedStat(
  value: number,
  floor: number,
  sentence: string,
  suppressedSentence: string,
): Stat {
  return value >= floor ? shownStat(value, sentence) : suppressedStat(suppressedSentence);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle] as number;
  return Math.round(((sorted[middle - 1] as number) + (sorted[middle] as number)) / 2);
}

/** The four lifecycle words the packet card writes. */
export type DeliverableStatus = "open" | "delivered" | "accepted" | "set_aside";

export const DELIVERABLE_STATUS_LABELS: Record<DeliverableStatus, string> = {
  open: "Open",
  delivered: "Delivered",
  accepted: "Accepted",
  set_aside: "Set aside",
};

/** Legacy rows hold "active" or "open". Anything unrecognised reads as Open. */
export function normalizeDeliverableStatus(raw: string | null | undefined): DeliverableStatus {
  if (raw === "delivered" || raw === "accepted" || raw === "set_aside") return raw;
  return "open";
}

/**
 * The timestamps that go with a lifecycle move. Moving back to open clears
 * both, so a reopened piece of work never carries a stale delivery date.
 */
export function taskLifecyclePatch(
  status: DeliverableStatus,
  now: string,
  currentDeliveredAt: string | null = null,
): { status: DeliverableStatus; delivered_at: string | null; accepted_at: string | null } {
  if (status === "delivered")
    return { status, delivered_at: currentDeliveredAt ?? now, accepted_at: null };
  if (status === "accepted")
    return { status, delivered_at: currentDeliveredAt ?? now, accepted_at: now };
  return { status, delivered_at: null, accepted_at: null };
}

export type LabelledCount = { label: string; count: number };

export type FirmDashboard = {
  window_days: number;
  adoption: {
    seats: number | null;
    seats_used: number;
    active_members: number;
    weekly_active: Stat;
    capture_coverage: { numerator: number | null; denominator: number; sentence: string };
    time_to_first_capture: Stat;
  };
  activity: {
    work_items_captured: Stat;
    deliverables: { status: DeliverableStatus; label: string; count: number }[];
    deliverables_total: number;
    cycle_time: Stat;
    analyses_by_preset: LabelledCount[];
    analyses_total: number;
    questions_asked: Stat;
  };
  assurance: {
    verification_runs: number;
    firm_check_runs: number;
    total_runs: number;
    enough: boolean;
  };
  coaching: {
    coaches_active: number;
    engagements_shared: number;
    one_on_one_preps: number;
  };
  data_health: {
    connectors_by_vendor: LabelledCount[];
    last_capture_days_ago: number | null;
    errors_by_kind: LabelledCount[];
    connector_errors: number;
  };
  panels_shown: number;
};

/** Historical preset ids that no longer exist read as this, never as a raw id. */
export const OTHER_ANALYSIS_LABEL = "Other analysis";

export function relativeDayPhrase(days: number | null): string {
  if (days === null) return "No capture recorded yet.";
  if (days <= 0) return "Last capture today.";
  if (days === 1) return "Last capture yesterday.";
  return `Last capture ${days} days ago.`;
}

/**
 * A payload from this surface must carry aggregates only. This walk is the
 * enforcement: it returns the paths of anything that looks like a person.
 */
const PERSON_KEYS = new Set([
  "profile_id",
  "profileId",
  "display_name",
  "displayName",
  "owner_id",
  "ownerId",
  "actor_hash",
  "actorHash",
  "tenant_hash",
  "tenantHash",
  "user_id",
  "userId",
  "email",
  "author_profile_id",
  "subject_profile_id",
]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/i;

export function personIdentifyingPaths(value: unknown, path = "$"): string[] {
  const found: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((entry, index) => found.push(...personIdentifyingPaths(entry, `${path}[${index}]`)));
    return found;
  }
  if (value && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (PERSON_KEYS.has(key)) found.push(`${path}.${key}`);
      found.push(...personIdentifyingPaths(entry, `${path}.${key}`));
    }
    return found;
  }
  if (typeof value === "string" && (UUID.test(value) || HEX64.test(value))) found.push(path);
  return found;
}

export type FirmCheckLibraryRow = {
  id: string;
  title: string;
  body: string;
  scope: "firm" | "engagement" | "person";
  active: boolean;
  created_at: string;
};

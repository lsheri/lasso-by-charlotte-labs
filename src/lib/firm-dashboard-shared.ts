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

/** The exact words the assurance panel shows below its floor. */
export const ASSURANCE_SUPPRESSED_SENTENCE =
  "The firm has not run enough checks this period for a count to say anything yet.";
/** The exact words the cycle time stat shows below its floor. */
export const CYCLE_TIME_SUPPRESSED_SENTENCE =
  "Not enough data yet to show how long acceptance takes.";

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

/* ---------------------------------------------------------------------------
 * Pass 112: the firm view as tiles. Nothing below changes what a number means
 * or when it is withheld. It only decides whether an honest statement gets a
 * tile or one line in the waiting strip.
 * ------------------------------------------------------------------------- */

/** Always visible, above everything else on the firm page. */
export const TRUST_SUMMARY_LINE =
  "Counts and structure only. The work stays with the person who did it. The archive is the one exception, shipped by its owner.";

/** The toggle that opens the full honesty card. */
export const HOW_THIS_WORKS_LABEL = "How this view works";

/** The small caps heading over the collapsed withholdings. */
export const WAITING_LABEL = "Waiting for scale";

/** One withheld metric, one line. */
export function waitingLine(name: string): string {
  return `${name}: too small to mean anything yet.`;
}

export type MetricTile = {
  key: string;
  name: string;
  /** What the tile prints big. */
  value: string;
  /** The caveat sentence the old section already showed. */
  caveat: string;
};

export type FirmMetrics = { tiles: MetricTile[]; withheld: string[] };

function pushStat(
  out: FirmMetrics,
  key: string,
  name: string,
  stat: Stat,
): void {
  if (stat.value === null) out.withheld.push(name);
  else out.tiles.push({ key, name, value: String(stat.value), caveat: stat.sentence });
}

/**
 * Meaningful metrics become tiles, withheld metrics become strip lines. The
 * existing suppression flags are the only source of truth: count in, count out.
 */
export function buildFirmMetrics(data: FirmDashboard): FirmMetrics {
  const out: FirmMetrics = { tiles: [], withheld: [] };

  out.tiles.push({
    key: "seats",
    name: "Seats in use",
    value: String(data.adoption.seats_used),
    caveat:
      data.adoption.seats === null
        ? "No seat count on file."
        : `Of ${data.adoption.seats} seats. Coaches never use a seat.`,
  });

  pushStat(out, "weekly_active", "Active in the last week", data.adoption.weekly_active);

  const coverage = data.adoption.capture_coverage;
  if (coverage.numerator === null) out.withheld.push("Capture coverage");
  else
    out.tiles.push({
      key: "capture_coverage",
      name: "Capture coverage",
      value: `${coverage.numerator} of ${coverage.denominator}`,
      caveat: coverage.sentence,
    });

  pushStat(
    out,
    "time_to_first_capture",
    "Time to first capture",
    data.adoption.time_to_first_capture,
  );
  pushStat(out, "work_captured", "Work captured", data.activity.work_items_captured);
  pushStat(out, "cycle_time", "Delivered to accepted", data.activity.cycle_time);
  pushStat(out, "questions_asked", "Questions asked", data.activity.questions_asked);

  if (data.assurance.enough) {
    out.tiles.push({
      key: "verification_runs",
      name: "Verification analyses run",
      value: String(data.assurance.verification_runs),
      caveat: "Counts only, never results and never a rate.",
    });
    out.tiles.push({
      key: "firm_check_runs",
      name: "Firm checks analyses run",
      value: String(data.assurance.firm_check_runs),
      caveat: "Counts only, never results and never a rate.",
    });
  } else {
    out.withheld.push("Verification analyses run");
    out.withheld.push("Firm checks analyses run");
  }

  if (data.coaching.coaches_active === 0) {
    out.withheld.push("Coaching");
  } else {
    out.tiles.push({
      key: "coaches_active",
      name: "Coaches active",
      value: String(data.coaching.coaches_active),
      caveat: `${data.coaching.engagements_shared} engagements shared with a coach. ${data.coaching.one_on_one_preps} 1:1 preps created.`,
    });
  }

  return out;
}

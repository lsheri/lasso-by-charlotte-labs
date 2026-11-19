/**
 * 18 Nov 2026, founder AI costs: the pure half of /founder/costs. Reads nothing; the server function hands it
 * ai_usage rows plus the org and person names, and this groups them into totals, firms, people, surfaces and days.
 *
 * Person-level cost is founder accounting only (see the note on aiUsageRow in ai.server.ts). Nothing here may be
 * imported by a firm, partner or member surface; the only reader is the founder page behind the staff gate.
 */

/** The only email domain that may open the page, checked on the server alongside platform_admins. */
export const STAFF_EMAIL_DOMAIN = "charlotte-labs.com";

/** platform_admins roles that may read person-level cost. Founder only for now. */
export const COST_READER_ROLES = ["founder"] as const;

export const COST_RANGE_DAYS = [1, 7, 30] as const;
export type CostRangeDays = (typeof COST_RANGE_DAYS)[number];
export const COST_DEFAULT_DAYS: CostRangeDays = 7;
/** A custom range may span at most this many days, so one read stays bounded. */
export const COST_MAX_CUSTOM_DAYS = 92;

export type CostRangeInput = { days?: number | null; from?: string | null; to?: string | null };
export type CostRange = { fromIso: string; toIso: string; label: string; days: string[] };

export type AiUsageCostRow = {
  org_id: string | null;
  profile_id: string | null;
  surface: string;
  cost_usd: number | string | null;
  created_at: string;
};

export type CostPerson = { profileId: string | null; name: string; calls: number; costUsd: number };
export type CostFirm = {
  orgId: string | null;
  name: string;
  calls: number;
  costUsd: number;
  people: number;
  persons: CostPerson[];
};
export type CostSurface = { surface: string; calls: number; costUsd: number; avgCostUsd: number };
export type CostDay = { day: string; calls: number; costUsd: number };
export type AiCostReport = {
  range: { from: string; to: string; label: string };
  totals: { calls: number; costUsd: number };
  firms: CostFirm[];
  surfaces: CostSurface[];
  daily: CostDay[];
};

export const AI_COSTS_COPY = {
  title: "AI costs",
  intro: "What every model call cost, by firm, person and surface. Charlotte Labs staff only.",
  loading: "Loading costs…",
  empty: "No model calls in this range.",
  refused: "This page is for Charlotte Labs staff only.",
  failed: "Costs did not load. Try again.",
  retry: "Try again",
  range: "Range",
  from: "From",
  to: "To",
  apply: "Show",
  custom: "Custom dates",
  rangeOption: (days: CostRangeDays) => (days === 1 ? "Last 24 hours" : `Last ${days} days`),
  totalCalls: "Calls",
  totalCost: "Cost",
  firms: "By firm",
  surfaces: "By surface",
  daily: "By day",
  firm: "Firm",
  person: "Person",
  people: "People",
  calls: "Calls",
  cost: "Cost",
  avg: "Average per call",
  surface: "Surface",
  day: "Day",
  showPeople: (name: string) => `Show people in ${name}`,
  hidePeople: (name: string) => `Hide people in ${name}`,
  noWorkspace: "No workspace",
  systemCalls: "System calls",
  unknownFirm: "Unknown firm",
  unknownPerson: "Unknown person",
  badRange: "Pick a start date on or before the end date, at most 92 days apart.",
} as const;

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function utcDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function parseDay(value: string): number | null {
  if (!DATE_ONLY.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(ms) || utcDay(ms) !== value ? null : ms;
}

function daysBetween(fromMs: number, toMs: number): string[] {
  const out: string[] = [];
  for (let ms = Date.parse(`${utcDay(fromMs)}T00:00:00.000Z`); ms < toMs; ms += DAY_MS) out.push(utcDay(ms));
  return out;
}

/**
 * Turns the picker's choice into a time window. A preset is the last N x 24 hours up to now; a custom range runs
 * from the start of `from` to the end of `to`, in UTC. Throws on a bad custom range; an unknown preset falls back
 * to the default.
 */
export function resolveCostRange(input: CostRangeInput | null | undefined, now: Date = new Date()): CostRange {
  const from = input?.from?.trim();
  const to = input?.to?.trim();
  if (from || to) {
    const fromMs = from ? parseDay(from) : null;
    const toDayMs = to ? parseDay(to) : null;
    if (fromMs === null || toDayMs === null || fromMs > toDayMs) throw new Error(AI_COSTS_COPY.badRange);
    const endMs = toDayMs + DAY_MS;
    if ((endMs - fromMs) / DAY_MS > COST_MAX_CUSTOM_DAYS) throw new Error(AI_COSTS_COPY.badRange);
    return {
      fromIso: new Date(fromMs).toISOString(),
      toIso: new Date(endMs).toISOString(),
      label: from === to ? from! : `${from} to ${to}`,
      days: daysBetween(fromMs, endMs),
    };
  }
  const days = (COST_RANGE_DAYS as readonly number[]).includes(input?.days ?? NaN)
    ? (input!.days as CostRangeDays)
    : COST_DEFAULT_DAYS;
  const endMs = now.getTime();
  const fromMs = endMs - days * DAY_MS;
  return {
    fromIso: new Date(fromMs).toISOString(),
    toIso: new Date(endMs).toISOString(),
    label: AI_COSTS_COPY.rangeOption(days),
    days: daysBetween(fromMs, endMs + 1),
  };
}

/** True only for an exact `charlotte-labs.com` address: no subdomains, no lookalikes, no test domains. */
export function isStaffEmail(email: string | null | undefined): boolean {
  if (typeof email !== "string") return false;
  const value = email.trim().toLowerCase();
  const at = value.lastIndexOf("@");
  if (at <= 0 || at !== value.indexOf("@")) return false;
  return value.slice(at + 1) === STAFF_EMAIL_DOMAIN;
}

/** Costs add up in micro-dollars so many small floats never drift. */
function toMicros(value: number | string | null | undefined): number {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? Math.round((n as number) * 1_000_000) : 0;
}

function fromMicros(micros: number): number {
  return micros / 1_000_000;
}

function byCost<T extends { costUsd: number; calls: number; name?: string; surface?: string; key?: string }>(a: T, b: T): number {
  return b.costUsd - a.costUsd || b.calls - a.calls || String(a.name ?? a.surface ?? "").localeCompare(String(b.name ?? b.surface ?? ""));
}

type Bucket = { calls: number; micros: number };
const bump = (map: Map<string, Bucket>, key: string, micros: number) => {
  const hit = map.get(key) ?? { calls: 0, micros: 0 };
  hit.calls += 1;
  hit.micros += micros;
  map.set(key, hit);
};

const NULL_KEY = "\u0000none";

/**
 * Groups the rows. Firms and people with the highest cost come first. A row with no profile is a system call: it
 * counts toward its firm but not toward the firm's people. A row with no org lands under "No workspace". Rows outside
 * the range's days still count in totals but have no day to land on.
 */
export function groupAiCosts(input: {
  rows: readonly AiUsageCostRow[];
  range: CostRange;
  orgNames?: Readonly<Record<string, string>>;
  personNames?: Readonly<Record<string, string>>;
}): AiCostReport {
  const { rows, range } = input;
  const orgNames = input.orgNames ?? {};
  const personNames = input.personNames ?? {};
  const totals: Bucket = { calls: 0, micros: 0 };
  const firms = new Map<string, Bucket>();
  const persons = new Map<string, Map<string, Bucket>>();
  const surfaces = new Map<string, Bucket>();
  const days = new Map<string, Bucket>(range.days.map((d) => [d, { calls: 0, micros: 0 }]));

  for (const row of rows) {
    const micros = toMicros(row.cost_usd);
    const orgKey = row.org_id ?? NULL_KEY;
    const personKey = row.profile_id ?? NULL_KEY;
    totals.calls += 1;
    totals.micros += micros;
    bump(firms, orgKey, micros);
    if (!persons.has(orgKey)) persons.set(orgKey, new Map());
    bump(persons.get(orgKey)!, personKey, micros);
    bump(surfaces, row.surface || "unknown", micros);
    const day = typeof row.created_at === "string" ? row.created_at.slice(0, 10) : "";
    const slot = days.get(day);
    if (slot) {
      slot.calls += 1;
      slot.micros += micros;
    }
  }

  const firmList: CostFirm[] = [...firms.entries()].map(([orgKey, bucket]) => {
    const people = [...(persons.get(orgKey) ?? new Map<string, Bucket>()).entries()].map(([personKey, p]) => ({
      profileId: personKey === NULL_KEY ? null : personKey,
      name:
        personKey === NULL_KEY
          ? AI_COSTS_COPY.systemCalls
          : personNames[personKey]?.trim() || AI_COSTS_COPY.unknownPerson,
      calls: p.calls,
      costUsd: fromMicros(p.micros),
    }));
    people.sort(byCost);
    return {
      orgId: orgKey === NULL_KEY ? null : orgKey,
      name: orgKey === NULL_KEY ? AI_COSTS_COPY.noWorkspace : orgNames[orgKey]?.trim() || AI_COSTS_COPY.unknownFirm,
      calls: bucket.calls,
      costUsd: fromMicros(bucket.micros),
      people: people.filter((p) => p.profileId !== null).length,
      persons: people,
    };
  });
  firmList.sort(byCost);

  const surfaceList: CostSurface[] = [...surfaces.entries()].map(([surface, b]) => ({
    surface,
    calls: b.calls,
    costUsd: fromMicros(b.micros),
    avgCostUsd: b.calls ? Math.round(b.micros / b.calls) / 1_000_000 : 0,
  }));
  surfaceList.sort(byCost);

  return {
    range: { from: range.fromIso, to: range.toIso, label: range.label },
    totals: { calls: totals.calls, costUsd: fromMicros(totals.micros) },
    firms: firmList,
    surfaces: surfaceList,
    daily: range.days.map((day) => ({ day, calls: days.get(day)!.calls, costUsd: fromMicros(days.get(day)!.micros) })),
  };
}

/** USD for the page: four decimals under a dollar, so a $0.0031 call is not shown as $0.00; cents above. */
export function formatUsd(value: number): string {
  const n = Number.isFinite(value) ? value : 0;
  const digits = Math.abs(n) < 1 ? 4 : 2;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

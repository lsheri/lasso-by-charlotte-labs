import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { analysisPreset } from "./analysis-presets";
import {
  DELIVERABLE_STATUS_LABELS,
  MIN_ACTIVITY,
  MIN_ACTORS,
  MIN_ASSURANCE_RUNS,
  MIN_CYCLE_SAMPLES,
  OTHER_ANALYSIS_LABEL,
  gatedStat,
  median,
  normalizeDeliverableStatus,
  shownStat,
  suppressedStat,
  type DeliverableStatus,
  type FirmDashboard,
  type LabelledCount,
} from "./firm-dashboard-shared";
import { sha256Hex } from "./telemetry.server";

const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function tally(values: (string | null)[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = value ?? "unknown";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function toLabelled(counts: Map<string, number>, label: (key: string) => string): LabelledCount[] {
  return [...counts.entries()]
    .map(([key, count]) => ({ label: label(key), count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Every read here is pinned to one org. `events` and `connector_accounts`
 * carry no org column, so they are pinned by a server-computed tenant hash and
 * by the org's own profile ids. No content column is ever selected, and no
 * person identifier leaves this function.
 */
export async function buildFirmDashboard(
  supabaseAdmin: SupabaseClient<Database>,
  orgId: string,
): Promise<FirmDashboard> {
  const tenantHash = await sha256Hex(orgId);
  const since = daysAgo(WINDOW_DAYS);
  const week = daysAgo(7);
  const quarter = daysAgo(90);
  const month = monthStart();

  const [profilesRes, entitlementRes, workItemsRes, engagementsRes, analysesRes, notesRes] =
    await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, role, created_at, deactivated_at")
        .eq("org_id", orgId),
      supabaseAdmin
        .from("entitlements")
        .select("seats")
        .eq("org_id", orgId)
        .eq("status", "active")
        .maybeSingle(),
      supabaseAdmin
        .from("work_items")
        .select("owner_id, captured_at")
        .eq("org_id", orgId),
      supabaseAdmin.from("engagements").select("id").eq("org_id", orgId),
      supabaseAdmin
        .from("analysis_runs")
        .select("preset, created_at")
        .eq("org_id", orgId)
        .gte("created_at", since),
      supabaseAdmin
        .from("one_on_one_notes")
        .select("id", { count: "exact", head: true })
        .eq("org_id", orgId),
    ]);

  const profiles = profilesRes.data ?? [];
  const activeProfiles = profiles.filter((p) => !p.deactivated_at);
  const activeMembers = activeProfiles.filter((p) => p.role !== "coach");
  const coachesActive = activeProfiles.filter((p) => p.role === "coach").length;
  const orgProfileIds = profiles.map((p) => p.id);
  const engagementIds = (engagementsRes.data ?? []).map((e) => e.id);

  const [eventsRes, connectorsRes, healthRes, tasksRes, sharedRes] = await Promise.all([
    supabaseAdmin
      .from("events")
      .select("event_type, actor_hash, ts")
      .eq("tenant_hash", tenantHash)
      .gte("ts", since),
    orgProfileIds.length
      ? supabaseAdmin
          .from("connector_accounts")
          .select("profile_id, toolkit, status")
          .in("profile_id", orgProfileIds)
      : Promise.resolve({ data: [] as { profile_id: string; toolkit: string; status: string }[] }),
    supabaseAdmin
      .from("ai_health_events")
      .select("kind")
      .eq("org_id", orgId)
      .gte("created_at", since),
    engagementIds.length
      ? supabaseAdmin
          .from("tasks")
          .select("status, delivered_at, accepted_at")
          .in("engagement_id", engagementIds)
      : Promise.resolve({
          data: [] as { status: string; delivered_at: string | null; accepted_at: string | null }[],
        }),
    engagementIds.length
      ? supabaseAdmin
          .from("engagement_members")
          .select("engagement_id")
          .eq("member_role", "coach")
          .in("engagement_id", engagementIds)
      : Promise.resolve({ data: [] as { engagement_id: string }[] }),
  ]);

  const events = eventsRes.data ?? [];
  const connectors = (connectorsRes.data ?? []) as {
    profile_id: string;
    toolkit: string;
    status: string;
  }[];
  const tasks = (tasksRes.data ?? []) as {
    status: string;
    delivered_at: string | null;
    accepted_at: string | null;
  }[];

  // Adoption
  const weeklyActorHashes = new Set(
    events.filter((e) => e.ts >= week && e.actor_hash).map((e) => e.actor_hash as string),
  );
  const enoughPeople = activeMembers.length >= MIN_ACTORS;
  const weeklyActive = enoughPeople
    ? shownStat(
        weeklyActorHashes.size,
        `${weeklyActorHashes.size} of ${activeMembers.length} members were active in the last seven days.`,
      )
    : suppressedStat("Too few people here for this to mean anything yet.");

  const connectedOwners = new Set(
    connectors.filter((c) => c.status === "connected").map((c) => c.profile_id),
  );
  const capturedThisMonth = new Set(
    (workItemsRes.data ?? []).filter((w) => w.captured_at >= month).map((w) => w.owner_id),
  );
  const coveredCount = [...capturedThisMonth].filter((id) => connectedOwners.has(id)).length;
  const captureCoverage = enoughPeople
    ? {
        numerator: coveredCount,
        denominator: activeMembers.length,
        sentence: `${coveredCount} of ${activeMembers.length} members have a connected source and captured this month.`,
      }
    : {
        numerator: null,
        denominator: activeMembers.length,
        sentence: "Too few people here for a coverage number to mean anything yet.",
      };

  const firstCaptureByOwner = new Map<string, string>();
  for (const item of workItemsRes.data ?? []) {
    const current = firstCaptureByOwner.get(item.owner_id);
    if (!current || item.captured_at < current) firstCaptureByOwner.set(item.owner_id, item.captured_at);
  }
  const joinDays: number[] = [];
  for (const profile of activeMembers) {
    if (profile.created_at < quarter) continue;
    const first = firstCaptureByOwner.get(profile.id);
    if (!first) continue;
    joinDays.push(
      Math.max(0, Math.round((Date.parse(first) - Date.parse(profile.created_at)) / DAY_MS)),
    );
  }
  const medianDays = median(joinDays);
  const timeToFirstCapture =
    joinDays.length >= MIN_ACTORS && medianDays !== null
      ? shownStat(
          medianDays,
          `Median ${medianDays} day${medianDays === 1 ? "" : "s"} from joining to first capture, across ${joinDays.length} members who joined recently.`,
        )
      : suppressedStat("Not enough recent joiners to show a typical time to first capture.");

  // Activity
  const capturedInWindow = (workItemsRes.data ?? []).filter((w) => w.captured_at >= since).length;
  const workItemsCaptured = gatedStat(
    capturedInWindow,
    MIN_ACTIVITY,
    `${capturedInWindow} pieces of work captured in the last ${WINDOW_DAYS} days.`,
    "Not enough activity this period.",
  );

  const statusCounts = new Map<DeliverableStatus, number>();
  for (const task of tasks) {
    const status = normalizeDeliverableStatus(task.status);
    statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
  }
  const deliverables = (["open", "delivered", "accepted", "set_aside"] as DeliverableStatus[]).map(
    (status) => ({
      status,
      label: DELIVERABLE_STATUS_LABELS[status],
      count: statusCounts.get(status) ?? 0,
    }),
  );

  const cycleSamples = tasks
    .filter((t) => t.delivered_at && t.accepted_at)
    .map((t) =>
      Math.max(0, Math.round((Date.parse(t.accepted_at as string) - Date.parse(t.delivered_at as string)) / DAY_MS)),
    );
  const cycleMedian = median(cycleSamples);
  const cycleTime =
    cycleSamples.length >= MIN_CYCLE_SAMPLES && cycleMedian !== null
      ? shownStat(
          cycleMedian,
          `Median ${cycleMedian} day${cycleMedian === 1 ? "" : "s"} from delivered to accepted, across ${cycleSamples.length} pieces of work.`,
        )
      : suppressedStat("Not enough data yet to show how long acceptance takes.");

  const analyses = analysesRes.data ?? [];
  const analysesByPreset = toLabelled(
    tally(analyses.map((a) => a.preset)),
    (key) => analysisPreset(key)?.label ?? OTHER_ANALYSIS_LABEL,
  );

  const questionCount = events.filter((e) => e.event_type === "reflect.message_sent").length;
  const questionsAsked = gatedStat(
    questionCount,
    MIN_ACTIVITY,
    `${questionCount} questions asked in the last ${WINDOW_DAYS} days.`,
    "Not enough activity this period.",
  );

  // Assurance
  const verificationRuns = analyses.filter((a) => a.preset === "verification").length;
  const firmCheckRuns = analyses.filter((a) => a.preset === "firm_checks").length;

  // Data health
  const connectorsByVendor = toLabelled(
    tally(connectors.map((c) => c.toolkit)),
    (key) => key,
  );
  const pushEvents = events.filter(
    (e) => e.event_type === "mcp.push" || e.event_type === "connector.synced",
  );
  const lastPush = pushEvents.reduce<string | null>(
    (latest, e) => (latest === null || e.ts > latest ? e.ts : latest),
    null,
  );
  const lastCaptureDaysAgo =
    lastPush === null ? null : Math.floor((Date.now() - Date.parse(lastPush)) / DAY_MS);
  const errorsByKind = toLabelled(
    tally((healthRes.data ?? []).map((row) => row.kind)),
    (key) => key,
  );
  const connectorErrors = events.filter((e) => e.event_type === "connector.error").length;

  return {
    window_days: WINDOW_DAYS,
    adoption: {
      seats: entitlementRes.data?.seats ?? null,
      seats_used: activeMembers.length,
      active_members: activeMembers.length,
      weekly_active: weeklyActive,
      capture_coverage: captureCoverage,
      time_to_first_capture: timeToFirstCapture,
    },
    activity: {
      work_items_captured: workItemsCaptured,
      deliverables,
      deliverables_total: tasks.length,
      cycle_time: cycleTime,
      analyses_by_preset: analysesByPreset,
      analyses_total: analyses.length,
      questions_asked: questionsAsked,
    },
    assurance: {
      verification_runs: verificationRuns,
      firm_check_runs: firmCheckRuns,
      total_runs: analyses.length,
      enough: analyses.length >= MIN_ASSURANCE_RUNS,
    },
    coaching: {
      coaches_active: coachesActive,
      engagements_shared: new Set((sharedRes.data ?? []).map((r) => r.engagement_id)).size,
      one_on_one_preps: notesRes.count ?? 0,
    },
    data_health: {
      connectors_by_vendor: connectorsByVendor,
      last_capture_days_ago: lastCaptureDaysAgo,
      errors_by_kind: errorsByKind,
      connector_errors: connectorErrors,
    },
    panels_shown: 6,
  };
}

export type FirmCheckLibraryRow = {
  id: string;
  title: string;
  body: string;
  scope: "firm" | "engagement" | "person";
  active: boolean;
  created_at: string;
};

/** The whole library, active and retired, for the org the caller administers. */
export async function listFirmCheckLibrary(
  supabaseAdmin: SupabaseClient<Database>,
  orgId: string,
): Promise<FirmCheckLibraryRow[]> {
  const { data, error } = await supabaseAdmin
    .from("firm_checks")
    .select("id, title, body, subject_profile_id, engagement_id, active, created_at")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    scope: row.subject_profile_id ? "person" : row.engagement_id ? "engagement" : "firm",
    active: row.active,
    created_at: row.created_at,
  }));
}

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";
import {
  COST_READER_ROLES,
  groupAiCosts,
  isStaffEmail,
  resolveCostRange,
  type AiCostReport,
  type AiUsageCostRow,
  type CostRangeInput,
} from "@/lib/ai-costs-shared";

type Admin = SupabaseClient<Database>;

/** Rows per read; Supabase caps a select at 1000. */
export const COST_PAGE_SIZE = 1000;
/** A hard stop so one page view never reads without end. */
export const COST_MAX_ROWS = 200_000;
const ID_CHUNK = 200;

function refuse(): never {
  throw new Response("Forbidden", { status: 403 });
}

/**
 * 18 Nov 2026, founder AI costs: the gate. Two checks, both on the server, both must pass, and any error fails
 * closed with 403: the signed-in user's email is an exact charlotte-labs.com address, and the user holds an active
 * platform_admins row with a cost reader role (the Charlotte Labs operator table, today founder only). QA
 * (@qaprobe.test) and demo (@kestrelbay.test) people fail the first check whatever their workspace role.
 */
export async function requireCostReader(admin: Admin, userId: string | null | undefined): Promise<void> {
  if (!userId) refuse();
  let email: string | null | undefined;
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) refuse();
    email = data?.user?.email;
  } catch {
    refuse();
  }
  if (!isStaffEmail(email)) refuse();
  try {
    const { data, error } = await admin
      .from("platform_admins")
      .select("role")
      .eq("user_id", userId)
      .is("disabled_at", null)
      .limit(5);
    if (error) refuse();
    const roles = ((data ?? []) as { role: string }[]).map((r) => r.role);
    if (!roles.some((role) => (COST_READER_ROLES as readonly string[]).includes(role))) refuse();
  } catch (e) {
    if (e instanceof Response) throw e;
    refuse();
  }
}

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/** Reads every ai_usage row in the window, page by page. Read only. */
export async function readUsageRows(admin: Admin, fromIso: string, toIso: string): Promise<AiUsageCostRow[]> {
  const rows: AiUsageCostRow[] = [];
  for (let offset = 0; offset < COST_MAX_ROWS; offset += COST_PAGE_SIZE) {
    const { data, error } = await admin
      .from("ai_usage")
      .select("org_id, profile_id, surface, cost_usd, created_at")
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .order("id", { ascending: true })
      .range(offset, offset + COST_PAGE_SIZE - 1);
    if (error) throw new Error("Costs did not load.");
    const page = (data ?? []) as AiUsageCostRow[];
    rows.push(...page);
    if (page.length < COST_PAGE_SIZE) break;
  }
  return rows;
}

/** Org names for the firms in the rows. */
async function readOrgNames(admin: Admin, ids: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  for (const part of chunks(ids, ID_CHUNK)) {
    const { data } = await admin.from("orgs").select("id, name").in("id", part);
    for (const row of (data ?? []) as { id: string; name: string }[]) names[row.id] = row.name;
  }
  return names;
}

/** Display name for each person, or their email when the name is blank. */
async function readPersonNames(admin: Admin, ids: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {};
  const needEmail: { id: string; userId: string }[] = [];
  for (const part of chunks(ids, ID_CHUNK)) {
    const { data } = await admin.from("profiles").select("id, display_name, user_id").in("id", part);
    for (const row of (data ?? []) as { id: string; display_name: string | null; user_id: string | null }[]) {
      const name = row.display_name?.trim();
      if (name) names[row.id] = name;
      else if (row.user_id) needEmail.push({ id: row.id, userId: row.user_id });
    }
  }
  for (const { id, userId } of needEmail) {
    try {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data?.user?.email) names[id] = data.user.email;
    } catch {
      // A missing email leaves the person as "Unknown person".
    }
  }
  return names;
}

/** The whole read behind the page: gate, rows, names, then the pure grouping. */
export async function loadAiCostReport(
  admin: Admin,
  userId: string | null | undefined,
  input: CostRangeInput,
  now: Date = new Date(),
): Promise<AiCostReport> {
  await requireCostReader(admin, userId);
  const range = resolveCostRange(input, now);
  const rows = await readUsageRows(admin, range.fromIso, range.toIso);
  const orgIds = [...new Set(rows.map((r) => r.org_id).filter((v): v is string => !!v))];
  const profileIds = [...new Set(rows.map((r) => r.profile_id).filter((v): v is string => !!v))];
  const [orgNames, personNames] = await Promise.all([readOrgNames(admin, orgIds), readPersonNames(admin, profileIds)]);
  return groupAiCosts({ rows, range, orgNames, personNames });
}

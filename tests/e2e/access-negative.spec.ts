import { expect, test, type Page } from "@playwright/test";

import { findings, reportFindings, signIn, step } from "./qa-helpers";

/**
 * Spec F. Nothing here drives the interface. It signs in as a real person and
 * then asks the database the widest question it can from inside that browser
 * session, using the same address and key the app itself uses. Anything that
 * comes back is something that person is allowed to read.
 */

const URL_BASE = process.env["VITE_SUPABASE_URL"] ?? process.env["SUPABASE_URL"] ?? "";
const API_KEY =
  process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";

type Row = Record<string, unknown>;

/** Reads the signed in session out of the browser and asks PostgREST directly. */
async function selectAll(page: Page, table: string, columns: string): Promise<Row[]> {
  return page.evaluate(
    async ({ table, columns, base, key }) => {
      const entry = Object.keys(localStorage).find(
        (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
      );
      if (!entry) throw new Error("no signed in session in this browser");
      const raw = localStorage.getItem(entry) as string;
      const parsed = JSON.parse(raw.startsWith("base64-") ? atob(raw.slice(7)) : raw);
      const token = parsed?.access_token ?? parsed?.currentSession?.access_token;
      if (!token) throw new Error("session has no access token");
      const response = await fetch(
        `${base}/rest/v1/${table}?select=${encodeURIComponent(columns)}&limit=1000`,
        { headers: { apikey: key, Authorization: `Bearer ${token}` } },
      );
      if (!response.ok) {
        // A refusal is a pass for our purposes: nothing came back.
        if (response.status === 401 || response.status === 403) return [];
        throw new Error(`${table} read failed: ${response.status}`);
      }
      return (await response.json()) as Record<string, unknown>[];
    },
    { table, columns, base: URL_BASE, key: API_KEY },
  );
}

type Identity = { profileIds: string[]; orgIds: string[] };

async function whoAmI(page: Page): Promise<Identity> {
  const rows = await selectAll(page, "profiles", "id,org_id,user_id");
  const mine = rows.filter((r) => Boolean(r["user_id"]));
  const meUserId = await page.evaluate(() => {
    const entry = Object.keys(localStorage).find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    const raw = localStorage.getItem(entry as string) as string;
    const parsed = JSON.parse(raw.startsWith("base64-") ? atob(raw.slice(7)) : raw);
    return (parsed?.user?.id ?? parsed?.currentSession?.user?.id) as string;
  });
  const own = mine.filter((r) => r["user_id"] === meUserId);
  return {
    profileIds: own.map((r) => String(r["id"])),
    orgIds: [...new Set(own.map((r) => String(r["org_id"])))],
  };
}

const counts: string[] = [];

function record(who: string, table: string, total: number, foreign: number): void {
  counts.push(`${who} | ${table} | rows ${total} | not theirs ${foreign}`);
  step(`${who} reads ${table}`, `rest ${table}`, foreign === 0);
  if (foreign > 0) findings.push(`${who} could read ${foreign} ${table} row(s) that are not theirs`);
}

async function sweep(page: Page, who: string): Promise<Identity> {
  const me = await whoAmI(page);

  const work = await selectAll(page, "work_items", "id,owner_id,org_id");
  const mineWork = new Set(
    work.filter((r) => me.profileIds.includes(String(r["owner_id"]))).map((r) => String(r["id"])),
  );
  record(
    who,
    "work_items",
    work.length,
    work.filter(
      (r) =>
        !me.profileIds.includes(String(r["owner_id"])) && !me.orgIds.includes(String(r["org_id"])),
    ).length,
  );

  const turns = await selectAll(page, "turns", "id,work_item_id");
  const turnsElsewhere = turns.filter(
    (r) => !mineWork.has(String(r["work_item_id"])) && !work.some((w) => w["id"] === r["work_item_id"]),
  ).length;
  record(who, "turns", turns.length, turnsElsewhere);

  const engagements = await selectAll(page, "engagements", "id,org_id");
  record(
    who,
    "engagements",
    engagements.length,
    engagements.filter((r) => !me.orgIds.includes(String(r["org_id"]))).length,
  );

  const notes = await selectAll(page, "coaching_notes", "id,author_id,subject_id");
  record(
    who,
    "coaching_notes",
    notes.length,
    notes.filter(
      (r) =>
        !me.profileIds.includes(String(r["author_id"])) &&
        !me.profileIds.includes(String(r["subject_id"])),
    ).length,
  );

  const oneOnOne = await selectAll(page, "one_on_one_notes", "id,owner_id,org_id");
  record(
    who,
    "one_on_one_notes",
    oneOnOne.length,
    oneOnOne.filter((r) => !me.profileIds.includes(String(r["owner_id"]))).length,
  );

  return me;
}

test.describe.configure({ mode: "serial" });

test("nobody reads anybody else's record", async ({ page }) => {
  expect(URL_BASE, "backend address must be set for this walk").not.toBe("");

  await signIn(page, "qa.personal@qaprobe.test", /sign in/i);
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  const solo = await sweep(page, "qa.personal");

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, "qa.company.em@qaprobe.test", /sign in/i);
  await page.goto("/work", { waitUntil: "domcontentloaded" });
  const em = await sweep(page, "qa.company.em");

  // The teammate must not reach the solo workspace at all.
  const emWork = await selectAll(page, "work_items", "id,owner_id,org_id");
  const reachesSolo = emWork.filter((r) => solo.orgIds.includes(String(r["org_id"]))).length;
  record("qa.company.em vs QA Solo", "work_items", emWork.length, reachesSolo);

  await page.context().clearCookies();
  await page.evaluate(() => localStorage.clear());
  await signIn(page, "qa.company.coach@qaprobe.test", /sign in/i);
  await page.goto("/coaching", { waitUntil: "domcontentloaded" });
  await sweep(page, "qa.company.coach");

  // Work the teammate never mapped into a shared engagement.
  const coachWork = await selectAll(page, "work_items", "id,owner_id,org_id");
  const emsWork = coachWork.filter((r) => em.profileIds.includes(String(r["owner_id"])));
  counts.push(
    `qa.company.coach | work_items owned by the teammate | rows ${emsWork.length} (shared only)`,
  );

  console.log("--- access counts ---");
  for (const line of counts) console.log(`COUNT ${line}`);
  reportFindings("access-negative");

  expect(findings.filter((f) => f.includes("could read"))).toEqual([]);
});

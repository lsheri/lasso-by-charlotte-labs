import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { DEMO_NUMBER_COPY, demoNumber, demoNumberSaveInput, isDemoWorkspace } from "@/lib/demo-text-number-shared";
import { clearDemoNumber, demoNumberStatus, saveDemoNumber, type DemoNumberStore } from "@/lib/demo-text-number.server";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";

const NOW = new Date("2026-11-20T12:00:00Z");
const NUMBER = "+14155550123";
const DEMO = { type: "company", demo_firm: "kestrel-bay" };

type World = { role: string; settings: unknown; row: { phone: string; setAt: string | null } | null; readFails: boolean; saveFails: boolean };
function world(over: Partial<World> = {}) {
  const w: World = { role: "admin", settings: DEMO, row: null, readFails: false, saveFails: false, ...over };
  const saved: Record<string, unknown>[] = [];
  const events: string[] = [];
  let cleared = 0;
  const store: DemoNumberStore = {
    caller: async () => ({ profileId: "p1", orgId: "org-1", role: w.role, userId: "u1" }),
    settings: async () => w.settings,
    read: async () => (w.readFails ? undefined : w.row),
    save: async (row) => { if (w.saveFails) return false; saved.push(row); w.row = { phone: row.phone_e164, setAt: row.set_at }; return true; },
    clear: async () => { if (w.saveFails) return false; cleared += 1; w.row = null; return true; },
    record: async (_c, change) => { events.push(change); },
    now: () => NOW,
  };
  return { w, store, saved, events, cleared: () => cleared };
}

describe("what counts as a number", () => {
  it("takes United States and Canada numbers however they are typed", () => {
    for (const typed of ["4155550123", "415 555 0123", "(415) 555-0123", "415.555.0123", "1 415 555 0123", "+1 415 555 0123", " +14155550123 "]) expect(demoNumber(typed)).toBe(NUMBER);
    expect(demoNumber("604 555 0199")).toBe("+16045550199");
  });

  it("refuses other countries, short or long numbers, letters and junk", () => {
    for (const typed of ["+44 20 7946 0958", "+61412345678", "555 0123", "41555501234", "015 555 0123", "415 155 0123", "415-555-CALL", "", "   ", "+", "4155550123; drop table", "4".repeat(41), null, undefined, 4155550123, {}]) {
      expect(demoNumber(typed)).toBeNull();
    }
  });

  it("knows a demo workspace by its marker, and only a company one", () => {
    expect(isDemoWorkspace(DEMO)).toBe(true);
    for (const settings of [{ type: "company" }, { type: "company", demo_firm: "" }, { type: "company", demo_firm: null }, { type: "personal", demo_firm: "x" }, null, undefined, "demo_firm", [], 1]) {
      expect(isDemoWorkspace(settings)).toBe(false);
    }
  });

  it("reads a save's input without trusting it", () => {
    expect(demoNumberSaveInput({ phone: "415 555 0123", agreed: true, profile_id: "nope" })).toEqual({ profile_id: null, phone: "415 555 0123", agreed: true });
    expect(demoNumberSaveInput({ phone: 5 as never, agreed: "yes" as never })).toEqual({ profile_id: null, phone: "", agreed: false });
  });
});

describe("who may see or set it", () => {
  it("shows the card only to an admin of a demo workspace", async () => {
    expect(await demoNumberStatus(world().store)).toEqual({ show: true, set: false });
    for (const over of [{ role: "lead" }, { role: "em" }, { role: "analyst" }, { role: "coach" }, { settings: { type: "company" } }, { settings: null }] as Partial<World>[]) {
      expect(await demoNumberStatus(world(over).store)).toEqual({ show: false });
    }
  });

  it("refuses a save or a clear on the server for anyone else, and writes nothing", async () => {
    for (const over of [{ role: "lead" }, { role: "analyst" }, { settings: { type: "company" } }, { settings: { type: "personal", demo_firm: "x" } }] as Partial<World>[]) {
      const { store, saved, events, cleared } = world({ ...over, row: { phone: NUMBER, setAt: null } });
      expect(await saveDemoNumber(store, { profile_id: null, phone: NUMBER, agreed: true })).toEqual({ ok: false, problem: DEMO_NUMBER_COPY.problems.notHere });
      expect(await clearDemoNumber(store)).toEqual({ ok: false, problem: DEMO_NUMBER_COPY.problems.notHere });
      expect(saved).toEqual([]);
      expect(cleared()).toBe(0);
      expect(events).toEqual([]);
    }
  });
});

describe("setting, changing and clearing", () => {
  it("saves the number with who and when, and answers with the last two digits only", async () => {
    const { store, saved, events } = world();
    const result = await saveDemoNumber(store, { profile_id: null, phone: "(415) 555-0123", agreed: true });
    expect(result).toEqual({ ok: true, status: { show: true, set: true, lastTwo: "23", setAt: NOW.toISOString() } });
    expect(saved).toEqual([{ org_id: "org-1", phone_e164: NUMBER, person_agreed: true, set_by: "p1", set_at: NOW.toISOString() }]);
    expect(events).toEqual(["set"]);
    expect(JSON.stringify(result)).not.toContain("415");
    expect(await demoNumberStatus(store)).toEqual({ show: true, set: true, lastTwo: "23", setAt: NOW.toISOString() });
    expect(JSON.stringify(await demoNumberStatus(store))).not.toContain("5550");
  });

  it("needs the tick and a real number, each with its own plain line", async () => {
    const { store, saved } = world();
    expect(await saveDemoNumber(store, { profile_id: null, phone: NUMBER, agreed: false })).toEqual({ ok: false, problem: DEMO_NUMBER_COPY.problems.agreed });
    expect(await saveDemoNumber(store, { profile_id: null, phone: "+44 20 7946 0958", agreed: true })).toEqual({ ok: false, problem: DEMO_NUMBER_COPY.problems.number });
    expect(saved).toEqual([]);
  });

  it("replaces a number, clears it, and says so when a write fails", async () => {
    const { store, w, events } = world({ row: { phone: NUMBER, setAt: null } });
    expect(await saveDemoNumber(store, { profile_id: null, phone: "604 555 0199", agreed: true })).toMatchObject({ ok: true, status: { lastTwo: "99" } });
    expect(await clearDemoNumber(store)).toEqual({ ok: true, status: { show: true, set: false } });
    expect(w.row).toBeNull();
    expect(events).toEqual(["set", "cleared"]);
    const broken = world({ saveFails: true });
    expect(await saveDemoNumber(broken.store, { profile_id: null, phone: NUMBER, agreed: true })).toEqual({ ok: false, problem: DEMO_NUMBER_COPY.problems.failed });
    expect(await clearDemoNumber(broken.store)).toEqual({ ok: false, problem: DEMO_NUMBER_COPY.problems.failed });
    expect(broken.events).toEqual([]);
    await expect(demoNumberStatus(world({ readFails: true }).store)).rejects.toThrow();
  });

  it("keeps the number when recording the event fails", async () => {
    const { store, saved } = world();
    store.record = async () => { throw new Error("down"); };
    expect(await saveDemoNumber(store, { profile_id: null, phone: NUMBER, agreed: true })).toMatchObject({ ok: true });
    expect(saved).toHaveLength(1);
  });
});

describe("the number stays on the server", () => {
  const server = readFileSync("src/lib/demo-text-number.server.ts", "utf8");
  const functions = readFileSync("src/lib/demo-text-number.functions.ts", "utf8");
  const sql = readFileSync("supabase/migrations/20261120010000_proposals.sql", "utf8");

  it("the event carries only set or cleared", () => {
    expect(EVENT_DIM_KEYS["demo_text_number.changed"]).toEqual(["change"]);
    expect(server).toContain('dims: { change }');
  });

  it("nothing logs, and only the send's own reader returns a number", () => {
    expect(server).not.toMatch(/console\./);
    expect(server.match(/phone_e164/g)?.length).toBeGreaterThan(0);
    const handlers = server.slice(server.indexOf("export const demoNumberHandlers"));
    expect(handlers).not.toContain("demoRecipient");
    expect(functions).not.toContain("demoRecipient");
    for (const name of ["demoNumberStatusFn", "saveDemoNumberFn", "clearDemoNumberFn"]) {
      const start = functions.indexOf(`export const ${name}`);
      expect(functions.slice(start, start + 200)).toContain(".middleware([requireSupabaseAuth])");
    }
    expect(server).toContain("await requireFirmMember(context.supabase, context.userId, profileId)");
  });

  it("the table is closed to every signed-in person and refuses a workspace that is not a demo", () => {
    const part = sql.slice(sql.indexOf("demo_text_recipients"));
    expect(part).toContain("enable row level security");
    expect(part).toMatch(/revoke all on (table )?public\.demo_text_recipients from [^;]*authenticated/);
    expect(part).toContain("a typed number is for demo workspaces only");
    expect(part).not.toMatch(/create policy[^;]*demo_text_recipients/);
  });
});

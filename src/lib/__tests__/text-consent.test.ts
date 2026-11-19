// 19 Nov 2026: agreeing to text messages. The pure rules, the server decision with a fake store, and the floors:
// the wording is pinned, and no number can reach a log line or an answer.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  allowConsentAttempt,
  consentRow,
  recordTextConsent,
  type ConsentRow,
  type ConsentStore,
} from "@/lib/text-consent.server";
import {
  checkTextConsent,
  cleanName,
  cleanWorkspace,
  normalizePhone,
  TEXT_CONSENT_COPY,
  TEXT_CONSENT_VERSION,
  TEXT_CONSENT_WORDING,
} from "@/lib/text-consent-shared";

const ORG = "0000000a-0000-4000-8000-000000000001";
const PERSON = "0000000c-0000-4000-8000-000000000007";
const GOOD = { name: "Renée O'Neill-Smith", phone: "(206) 867-5309", agreed: true };

function fakeStore(over: Partial<ConsentStore> = {}) {
  const rows: ConsentRow[] = [];
  const store: ConsentStore = {
    workspaceExists: async (id) => id === ORG,
    contactInWorkspace: async (workspaceId, contactId) =>
      workspaceId === ORG && contactId === PERSON,
    // The two database rules: one live agreement per number, and one per roster person.
    insert: async (row) => {
      if (rows.some((r) => r.phone_e164 === row.phone_e164)) return "already";
      if (row.roster_contact_id && rows.some((r) => r.roster_contact_id === row.roster_contact_id))
        return "already";
      rows.push(row);
      return "stored";
    },
    attach: async (phone, workspaceId, contactId) => {
      if (rows.some((r) => r.roster_contact_id === contactId)) return;
      const row = rows.find(
        (r) =>
          r.phone_e164 === phone &&
          !r.roster_contact_id &&
          (r.org_id === null || r.org_id === workspaceId),
      );
      if (row) Object.assign(row, { org_id: workspaceId, roster_contact_id: contactId });
    },
    ...over,
  };
  return { rows, store };
}
const deps = (store: ConsentStore, allow = () => true) => ({
  store,
  allow,
  clientKey: "203.0.113.9",
});

describe("the wording", () => {
  it("is the sentence the carrier registration quotes, word for word", () => {
    expect(TEXT_CONSENT_WORDING).toBe(
      "I agree to receive text messages from Lasso about proposals and projects I am asked to help with. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help.",
    );
    // A change to the sentence must come with a new version.
    expect(TEXT_CONSENT_VERSION).toBe("tc-v1");
  });

  it("has no em dash anywhere in the page's copy", () => {
    expect(JSON.stringify(TEXT_CONSENT_COPY) + TEXT_CONSENT_WORDING).not.toMatch(/[—–]/);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["(206) 867-5309", "+12068675309"],
    ["206.867.5309", "+12068675309"],
    ["206 867 5309", "+12068675309"],
    ["2068675309", "+12068675309"],
    ["+1 206 867 5309", "+12068675309"],
    ["1-206-867-5309", "+12068675309"],
    ["  +1(416)867-5309 ", "+14168675309"],
  ])("accepts %s", (typed, stored) => expect(normalizePhone(typed)).toBe(stored));

  it.each([
    [""],
    ["867-5309"],
    ["206 867 530"],
    ["206 867 53099"],
    ["106 867 5309"], // area code cannot start 0 or 1
    ["206 167 5309"], // exchange cannot start 0 or 1
    ["+44 20 7946 0958"], // not the United States or Canada
    ["+52 55 1234 5678"],
    ["206 867 5309 ext 4"],
    ["call me"],
    ["206-867-5309; drop table"],
    ["<script>2068675309</script>"],
    ["++12068675309"],
    ["２０６８６７５３０９"], // full-width digits
    ["2".repeat(200)],
  ])("refuses %s", (typed) => expect(normalizePhone(typed)).toBeNull());

  it("refuses anything that is not a string", () => {
    for (const value of [null, undefined, 2068675309, {}, ["2068675309"]])
      expect(normalizePhone(value)).toBeNull();
  });
});

describe("cleanName and cleanWorkspace", () => {
  it("keeps accents, hyphens and apostrophes, and tidies space", () => {
    expect(cleanName("  Renée   O'Neill-Smith \n")).toBe("Renée O'Neill-Smith");
    expect(cleanName("St. Brigid")).toBe("St. Brigid");
  });
  it("refuses empty, blank, overlong and non-strings", () => {
    expect(cleanName("")).toBeNull();
    expect(cleanName(" \t\n ")).toBeNull();
    expect(cleanName("a".repeat(121))).toBeNull();
    expect(cleanName("a".repeat(120))).toHaveLength(120);
    expect(cleanName(42)).toBeNull();
  });
  it("takes a workspace only when it is shaped like an id", () => {
    expect(cleanWorkspace(ORG.toUpperCase())).toBe(ORG);
    for (const value of ["", "kestrel-bay", `${ORG}'; --`, null, 7])
      expect(cleanWorkspace(value)).toBeNull();
  });
});

describe("checkTextConsent", () => {
  it("passes a full, ticked form", () => {
    expect(checkTextConsent({ ...GOOD, workspace: ORG })).toEqual({
      ok: true,
      record: { name: "Renée O'Neill-Smith", phone: "+12068675309", workspace: ORG, contact: null },
    });
  });
  it("names every problem at once", () => {
    expect(checkTextConsent({ name: " ", phone: "nope", agreed: false })).toEqual({
      ok: false,
      problems: ["name", "phone", "agree"],
    });
    expect(checkTextConsent(null)).toEqual({ ok: false, problems: ["name", "phone", "agree"] });
  });
  it("counts only a real tick as agreeing", () => {
    for (const agreed of [false, undefined, null, "true", "on", 1, {}]) {
      expect(checkTextConsent({ ...GOOD, agreed })).toEqual({ ok: false, problems: ["agree"] });
    }
  });
});

describe("recordTextConsent", () => {
  it("stores one row with the exact wording and its version", async () => {
    const { rows, store } = fakeStore();
    expect(await recordTextConsent({ ...GOOD, workspace: ORG }, deps(store))).toEqual({ ok: true });
    expect(rows).toEqual([
      {
        org_id: ORG,
        full_name: "Renée O'Neill-Smith",
        phone_e164: "+12068675309",
        consent_text: TEXT_CONSENT_WORDING,
        consent_version: "tc-v1",
        source: "public_page",
      },
    ]);
  });

  it("refuses an unticked box, a bad number and a missing name, and writes nothing", async () => {
    const { rows, store } = fakeStore();
    expect(await recordTextConsent({ ...GOOD, agreed: false }, deps(store))).toEqual({
      ok: false,
      reason: "invalid",
      problems: ["agree"],
    });
    expect(await recordTextConsent({ ...GOOD, phone: "+44 20 7946 0958" }, deps(store))).toEqual({
      ok: false,
      reason: "invalid",
      problems: ["phone"],
    });
    expect(await recordTextConsent({ ...GOOD, name: "" }, deps(store))).toEqual({
      ok: false,
      reason: "invalid",
      problems: ["name"],
    });
    expect(await recordTextConsent("junk", deps(store))).toMatchObject({
      ok: false,
      reason: "invalid",
    });
    expect(rows).toHaveLength(0);
  });

  it("answers the same for a number already on file, and adds no second row", async () => {
    const { rows, store } = fakeStore();
    const first = await recordTextConsent(GOOD, deps(store));
    const again = await recordTextConsent({ ...GOOD, phone: "206.867.5309" }, deps(store));
    expect(again).toEqual(first);
    expect(rows).toHaveLength(1);
  });

  it("keeps the agreement when the link's workspace does not exist, filed under none, with the same answer", async () => {
    const { rows, store } = fakeStore();
    const unknown = await recordTextConsent(
      { ...GOOD, workspace: "0000000a-0000-4000-8000-00000000dead" },
      deps(store),
    );
    expect(unknown).toEqual({ ok: true });
    expect(rows[0]?.org_id).toBeNull();
  });

  it("is refused before any read or write when pressed too often", async () => {
    const workspaceExists = vi.fn(async () => true);
    const insert = vi.fn(async () => "stored" as const);
    expect(
      await recordTextConsent(
        GOOD,
        deps(fakeStore({ workspaceExists, insert }).store, () => false),
      ),
    ).toEqual({ ok: false, reason: "busy" });
    expect(workspaceExists).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("says it did not save when the write fails or throws, never that it worked", async () => {
    expect(
      await recordTextConsent(GOOD, deps(fakeStore({ insert: async () => "failed" }).store)),
    ).toEqual({ ok: false, reason: "unavailable" });
    const thrower = fakeStore({
      insert: async () => {
        throw new Error("Key (phone_e164)=(+12068675309) already exists");
      },
    }).store;
    const result = await recordTextConsent(GOOD, deps(thrower));
    expect(result).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(result)).not.toContain("2068675309");
  });

  it("never puts the number or the name in an answer", async () => {
    const { store } = fakeStore();
    for (const input of [GOOD, { ...GOOD, agreed: false }, { ...GOOD, name: "" }]) {
      const answer = JSON.stringify(await recordTextConsent(input, deps(store)));
      expect(answer).not.toMatch(/867|5309|Renée/);
    }
  });
});

describe("a roster person's own link", () => {
  const OTHER_ORG = "0000000b-0000-4000-8000-000000000002";
  const STRANGER = "0000000d-0000-4000-8000-000000000009";

  it("ties the agreement to the person when they are in the link's workspace", async () => {
    const { rows, store } = fakeStore();
    expect(
      await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store)),
    ).toEqual({ ok: true });
    expect(rows).toEqual([
      expect.objectContaining({
        org_id: ORG,
        roster_contact_id: PERSON,
        phone_e164: "+12068675309",
      }),
    ]);
  });

  it("drops a person who is not in that workspace, keeps the agreement, and answers the same", async () => {
    const { rows, store } = fakeStore();
    expect(
      await recordTextConsent({ ...GOOD, workspace: ORG, contact: STRANGER }, deps(store)),
    ).toEqual({ ok: true });
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("roster_contact_id");
    expect(rows[0]?.org_id).toBe(ORG);
  });

  it("names nobody when the person comes without a workspace, with an unknown one, or as junk", async () => {
    for (const input of [
      { ...GOOD, contact: PERSON },
      { ...GOOD, workspace: OTHER_ORG, contact: PERSON },
      { ...GOOD, workspace: ORG, contact: "1 or 1=1" },
      { ...GOOD, workspace: ORG, contact: { id: PERSON } },
    ]) {
      const { rows, store } = fakeStore();
      expect(await recordTextConsent(input, deps(store))).toEqual({ ok: true });
      expect(rows[0]).not.toHaveProperty("roster_contact_id");
    }
  });

  it("never asks about a person before the workspace is known to exist", async () => {
    const contactInWorkspace = vi.fn(async () => true);
    const { store } = fakeStore({ contactInWorkspace });
    await recordTextConsent({ ...GOOD, workspace: OTHER_ORG, contact: PERSON }, deps(store));
    expect(contactInWorkspace).not.toHaveBeenCalled();
  });

  it("keeps the first number: a second number through the same link is not stored, and the answer is the same", async () => {
    const { rows, store } = fakeStore();
    await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store));
    expect(
      await recordTextConsent(
        { ...GOOD, phone: "(206) 555-0142", workspace: ORG, contact: PERSON },
        deps(store),
      ),
    ).toEqual({ ok: true });
    expect(rows.map((r) => r.phone_e164)).toEqual(["+12068675309"]);
  });

  it("ties an agreement made before the person had a link, once they use their link", async () => {
    const { rows, store } = fakeStore();
    await recordTextConsent(GOOD, deps(store));
    expect(rows[0]).not.toHaveProperty("roster_contact_id");
    expect(
      await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store)),
    ).toEqual({ ok: true });
    expect(rows).toEqual([expect.objectContaining({ org_id: ORG, roster_contact_id: PERSON })]);
  });

  it("does not attach when nothing was already on file, or when the person was dropped", async () => {
    const attach = vi.fn(async () => undefined);
    const { store } = fakeStore({ attach });
    await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store));
    await recordTextConsent({ ...GOOD, workspace: ORG, contact: STRANGER }, deps(store));
    expect(attach).not.toHaveBeenCalled();
  });

  it("still answers that it saved when the tie fails: the agreement itself is on file", async () => {
    const { store } = fakeStore({
      insert: async () => "already",
      attach: async () => {
        throw new Error("Key (phone_e164)=(+12068675309)");
      },
    });
    expect(
      await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store)),
    ).toEqual({ ok: true });
  });

  it("leaves the person column off the row entirely when there is no person, so the page works before the roster table exists", () => {
    expect(
      Object.keys(
        consentRow({ name: "A", phone: "+12068675309", workspace: ORG, contact: null }, ORG),
      ),
    ).not.toContain("roster_contact_id");
    expect(
      Object.keys(
        consentRow(
          { name: "A", phone: "+12068675309", workspace: null, contact: PERSON },
          null,
          PERSON,
        ),
      ),
    ).not.toContain("roster_contact_id");
  });

  it("attaches only an agreement that names no person and no other workspace, read from the source", () => {
    const source = readFileSync("src/lib/text-consent.server.ts", "utf8");
    const attachBody = source.slice(
      source.indexOf("async attach("),
      source.indexOf("async insert("),
    );
    expect(attachBody).toContain('.is("revoked_at", null)');
    expect(attachBody).toContain('.is("roster_contact_id", null)');
    expect(attachBody).toContain("org_id.is.null,org_id.eq.${workspaceId}");
    expect(attachBody).not.toContain(".select(");
  });
});

describe("the limiter", () => {
  it("allows five presses in ten minutes from one address, then refuses, and frees up later", () => {
    const now = 1_800_000_000_000;
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i += 1) expect(allowConsentAttempt(key, now + i)).toBe(true);
    expect(allowConsentAttempt(key, now + 10)).toBe(false);
    expect(allowConsentAttempt(key, now + 10 * 60_000 + 11)).toBe(true);
  });
});

describe("the floors, read from the source", () => {
  const server = readFileSync("src/lib/text-consent.server.ts", "utf8");
  const fn = readFileSync("src/lib/text-consent.functions.ts", "utf8");
  const form = readFileSync("src/components/legal/TextConsentForm.tsx", "utf8");
  const route = readFileSync("src/routes/texts.tsx", "utf8");
  const sql = readFileSync("supabase/migrations/20261119230000_message_consents.sql", "utf8");

  it("records no event and logs only an error code", () => {
    for (const source of [server, fn, form, route])
      expect(source).not.toMatch(/recordEvent|logEvent|posthog\.capture|trackEvent/);
    const logs = [...server.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1]);
    // One line for a failed save and one for a failed tie, each an error code and nothing else.
    expect(logs).toHaveLength(2);
    for (const line of logs)
      expect(line).not.toMatch(/row|phone|name|message|details|input|record|contact|workspace/i);
    expect(form + route).not.toMatch(/console\./);
    expect(
      consentRow({ name: "A", phone: "+12068675309", workspace: null, contact: null }, null),
    ).not.toHaveProperty("ip");
  });

  it("keeps the page out of screen replay and click capture", () => {
    expect(route).toMatch(/stopSessionReplay\(\)/);
    expect(route).toMatch(/ph-no-capture/);
  });

  it("never reads a stored row back", () => {
    expect(server).not.toMatch(/from\("message_consents"\)\s*\.select/);
    expect(server).toMatch(/from\("message_consents"\)\.insert\(row\)/);
  });

  it("shuts the table to every browser role, and only adds", () => {
    expect(sql).toMatch(/alter table public\.message_consents enable row level security/);
    expect(sql).toMatch(
      /revoke all on table public\.message_consents from public, anon, authenticated/,
    );
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/\bto (anon|authenticated)\b/);
    expect(sql).not.toMatch(
      /\b(drop|truncate|delete from|alter table public\.(?!message_consents))/i,
    );
    expect(sql).not.toMatch(/[—]/);
  });

  it("stores only numbers the page accepts: the database rule matches the page rule", () => {
    const rule = new RegExp(sql.match(/phone_e164 ~ '([^']+)'/)![1]!);
    for (const typed of ["(206) 867-5309", "+1 416 867 5309"])
      expect(rule.test(normalizePhone(typed)!)).toBe(true);
    for (const stored of ["+442079460958", "+11068675309", "2068675309", "+120686753090"])
      expect(rule.test(stored)).toBe(false);
  });
});

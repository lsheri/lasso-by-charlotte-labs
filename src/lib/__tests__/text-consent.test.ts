// 19 Nov 2026: agreeing to text messages. The pure rules, the server decision with a fake store, and the floors:
// the wording is pinned, and no number can reach a log line or an answer.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  allowConsentAttempt,
  consentRow,
  consentRecords,
  recordTextConsent,
  stopTextConsent,
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
  TEXT_STOP_COPY,
} from "@/lib/text-consent-shared";

const ORG = "0000000a-0000-4000-8000-000000000001";
const PERSON = "0000000c-0000-4000-8000-000000000007";
const ORG_TWO = "0000000e-0000-4000-8000-000000000003";
const PERSON_TWO = "0000000f-0000-4000-8000-000000000004";
const GOOD = { name: "Renée O'Neill-Smith", phone: "(206) 867-5309", agreed: true };

type FakeRow = ConsentRow & { revoked?: "stop_link" | "number_changed" };

/**
 * A stand-in that keeps the database's own rules: one live agreement per number in each workspace, one live
 * agreement per roster person, and a number swap only while that person's change window is open.
 */
function fakeStore(over: Partial<ConsentStore> = {}) {
  const rows: FakeRow[] = [];
  const windows = new Set<string>();
  const live = () => rows.filter((r) => !r.revoked);
  const store: ConsentStore = {
    workspaceExists: async (id) => id === ORG || id === ORG_TWO,
    contactInWorkspace: async (workspaceId, contactId) =>
      (workspaceId === ORG && contactId === PERSON) ||
      (workspaceId === ORG_TWO && contactId === PERSON_TWO),
    insert: async (row) => {
      if (live().some((r) => r.phone_e164 === row.phone_e164 && r.org_id === row.org_id))
        return "already";
      if (
        row.roster_contact_id &&
        live().some((r) => r.roster_contact_id === row.roster_contact_id)
      )
        return "already";
      rows.push({ ...row });
      return "stored";
    },
    attach: async (phone, workspaceId, contactId) => {
      if (live().some((r) => r.roster_contact_id === contactId)) return;
      const row = live().find(
        (r) =>
          r.phone_e164 === phone &&
          !r.roster_contact_id &&
          (r.org_id === null || r.org_id === workspaceId),
      );
      if (row) Object.assign(row, { org_id: workspaceId, roster_contact_id: contactId });
    },
    replace: async (row) => {
      const old = live().find(
        (r) => r.roster_contact_id === row.roster_contact_id && r.org_id === row.org_id,
      );
      if (!old || old.phone_e164 === row.phone_e164 || !windows.has(row.roster_contact_id)) return;
      if (
        live().some(
          (r) => r.phone_e164 === row.phone_e164 && r.org_id === row.org_id && r.roster_contact_id,
        )
      ) {
        throw new Error(`Key (phone_e164)=(${row.phone_e164}) already exists`);
      }
      old.revoked = "number_changed";
      rows.push({ ...row });
      windows.delete(row.roster_contact_id);
    },
    stop: async (phone, workspaceId, contactId) => {
      for (const r of live())
        if (r.phone_e164 === phone && r.org_id === workspaceId && r.roster_contact_id === contactId)
          r.revoked = "stop_link";
      return true;
    },
    ...over,
  };
  return { rows, store, windows, live };
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

  it("says above the tick box what the texts are for: being asked for a part, and news of work you helped with (Q-49)", () => {
    expect(TEXT_CONSENT_COPY.intro).toBe(
      "A firm you work with uses Lasso to run its proposals and projects. If you agree, Lasso can text you when a firm asks for your part of a proposal, or when something you helped with moves, like a proposal you worked on being won. Only the moments that matter to you, never marketing.",
    );
    expect(TEXT_CONSENT_COPY.intro).not.toMatch(/[!—–]/);
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

  it("ties an agreement made with the workspace's plain link, once they use their own link", async () => {
    const { rows, store } = fakeStore();
    await recordTextConsent({ ...GOOD, workspace: ORG }, deps(store));
    expect(rows[0]).not.toHaveProperty("roster_contact_id");
    expect(
      await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store)),
    ).toEqual({ ok: true });
    expect(rows).toEqual([expect.objectContaining({ org_id: ORG, roster_contact_id: PERSON })]);
  });

  it("leaves an agreement made with no workspace as it is, and stores the person's own beside it", async () => {
    const { rows, store } = fakeStore();
    await recordTextConsent(GOOD, deps(store));
    await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store));
    expect(rows.map((r) => [r.org_id, r.roster_contact_id ?? null])).toEqual([
      [null, null],
      [ORG, PERSON],
    ]);
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

describe("one person, several firms", () => {
  it("keeps a live agreement for the same number in each workspace, each tied to that workspace's person", async () => {
    const { rows, store, live } = fakeStore();
    expect(
      await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store)),
    ).toEqual({ ok: true });
    expect(
      await recordTextConsent({ ...GOOD, workspace: ORG_TWO, contact: PERSON_TWO }, deps(store)),
    ).toEqual({ ok: true });
    expect(live().map((r) => [r.org_id, r.roster_contact_id, r.phone_e164])).toEqual([
      [ORG, PERSON, "+12068675309"],
      [ORG_TWO, PERSON_TWO, "+12068675309"],
    ]);
    expect(
      rows.every(
        (r) =>
          r.consent_text === TEXT_CONSENT_WORDING && r.consent_version === TEXT_CONSENT_VERSION,
      ),
    ).toBe(true);
  });

  it("never ties one workspace's person to another workspace's agreement", async () => {
    const { rows, store } = fakeStore();
    await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store));
    // The other firm's link with this firm's person id: the person is not in that workspace, so no tie.
    await recordTextConsent({ ...GOOD, workspace: ORG_TWO, contact: PERSON }, deps(store));
    expect(rows.filter((r) => r.roster_contact_id === PERSON)).toHaveLength(1);
    expect(rows[1]).toMatchObject({ org_id: ORG_TWO });
    expect(rows[1]).not.toHaveProperty("roster_contact_id");
  });

  it("stopping in one workspace leaves the other one live", async () => {
    const { store, live } = fakeStore();
    await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(store));
    await recordTextConsent({ ...GOOD, workspace: ORG_TWO, contact: PERSON_TWO }, deps(store));
    expect(
      await stopTextConsent({ phone: GOOD.phone, workspace: ORG, contact: PERSON }, deps(store)),
    ).toEqual({ ok: true });
    expect(live().map((r) => r.org_id)).toEqual([ORG_TWO]);
  });
});

describe("changing a number", () => {
  const NEW = "(206) 555-0142";
  const first = async (kit: ReturnType<typeof fakeStore>) =>
    recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(kit.store));

  it("does nothing while no window is open: the first number stays", async () => {
    const kit = fakeStore();
    await first(kit);
    expect(
      await recordTextConsent(
        { ...GOOD, phone: NEW, workspace: ORG, contact: PERSON },
        deps(kit.store),
      ),
    ).toEqual({ ok: true });
    expect(kit.live().map((r) => r.phone_e164)).toEqual(["+12068675309"]);
  });

  it("inside a window, ends the old agreement and stores the new one with the words and version, once", async () => {
    const kit = fakeStore();
    await first(kit);
    kit.windows.add(PERSON);
    expect(
      await recordTextConsent(
        { ...GOOD, phone: NEW, workspace: ORG, contact: PERSON },
        deps(kit.store),
      ),
    ).toEqual({ ok: true });
    expect(kit.rows.map((r) => [r.phone_e164, r.revoked ?? "live"])).toEqual([
      ["+12068675309", "number_changed"],
      ["+12065550142", "live"],
    ]);
    expect(kit.rows[1]).toMatchObject({
      org_id: ORG,
      roster_contact_id: PERSON,
      consent_text: TEXT_CONSENT_WORDING,
      consent_version: TEXT_CONSENT_VERSION,
    });
    // The window closed with the swap: a third number is not taken.
    await recordTextConsent(
      { ...GOOD, phone: "(206) 555-0199", workspace: ORG, contact: PERSON },
      deps(kit.store),
    );
    expect(kit.live().map((r) => r.phone_e164)).toEqual(["+12065550142"]);
  });

  it("changes the number in one workspace only", async () => {
    const kit = fakeStore();
    await first(kit);
    await recordTextConsent({ ...GOOD, workspace: ORG_TWO, contact: PERSON_TWO }, deps(kit.store));
    kit.windows.add(PERSON);
    await recordTextConsent(
      { ...GOOD, phone: NEW, workspace: ORG, contact: PERSON },
      deps(kit.store),
    );
    expect(kit.live().map((r) => [r.org_id, r.phone_e164])).toEqual([
      [ORG_TWO, "+12068675309"],
      [ORG, "+12065550142"],
    ]);
  });

  it("asks for a swap only when the link names a person in its workspace, and never on a first agreement", async () => {
    const replace = vi.fn(async () => undefined);
    const kit = fakeStore({ replace });
    await first(kit);
    await recordTextConsent({ ...GOOD, phone: NEW, workspace: ORG }, deps(kit.store));
    await recordTextConsent({ ...GOOD, phone: NEW }, deps(kit.store));
    expect(replace).not.toHaveBeenCalled();
    await recordTextConsent(
      { ...GOOD, phone: "(206) 555-0177", workspace: ORG, contact: PERSON },
      deps(kit.store),
    );
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith(
      expect.objectContaining({
        org_id: ORG,
        roster_contact_id: PERSON,
        phone_e164: "+12065550177",
        consent_text: TEXT_CONSENT_WORDING,
      }),
    );
  });

  it("answers the same, and keeps the old number, when the swap fails", async () => {
    const kit = fakeStore({
      replace: async () => {
        throw new Error("Key (phone_e164)=(+12065550142) already exists");
      },
    });
    await first(kit);
    const answer = await recordTextConsent(
      { ...GOOD, phone: NEW, workspace: ORG, contact: PERSON },
      deps(kit.store),
    );
    expect(answer).toEqual({ ok: true });
    expect(JSON.stringify(answer)).not.toMatch(/555|0142/);
    expect(kit.live().map((r) => r.phone_e164)).toEqual(["+12068675309"]);
  });

  it("a person who stopped can agree again through the same link, with any number", async () => {
    const kit = fakeStore();
    await first(kit);
    await stopTextConsent({ phone: GOOD.phone, workspace: ORG, contact: PERSON }, deps(kit.store));
    await recordTextConsent(
      { ...GOOD, phone: NEW, workspace: ORG, contact: PERSON },
      deps(kit.store),
    );
    expect(kit.rows.map((r) => [r.phone_e164, r.revoked ?? "live"])).toEqual([
      ["+12068675309", "stop_link"],
      ["+12065550142", "live"],
    ]);
  });
});

describe("stopping from the link", () => {
  const stopInput = { phone: GOOD.phone, workspace: ORG, contact: PERSON };

  it("ends the agreement for that person and number, and answers plainly", async () => {
    const kit = fakeStore();
    await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(kit.store));
    expect(await stopTextConsent(stopInput, deps(kit.store))).toEqual({ ok: true });
    expect(kit.live()).toEqual([]);
    expect(kit.rows[0]?.revoked).toBe("stop_link");
  });

  it("answers the same for a wrong number, an unknown person and a link with no person, and stops nothing", async () => {
    const kit = fakeStore();
    await recordTextConsent({ ...GOOD, workspace: ORG, contact: PERSON }, deps(kit.store));
    const stop = vi.spyOn(kit.store, "stop");
    for (const input of [
      { ...stopInput, phone: "(206) 555-0142" },
      { ...stopInput, contact: PERSON_TWO },
      { phone: GOOD.phone, workspace: ORG },
      { phone: GOOD.phone },
      { phone: GOOD.phone, contact: PERSON },
    ]) {
      expect(await stopTextConsent(input, deps(kit.store))).toEqual({ ok: true });
    }
    expect(kit.live()).toHaveLength(1);
    // Without a person's link nothing is even asked of the database.
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it("refuses a number that is not one, and is limited like agreeing, before any write", async () => {
    const stop = vi.fn(async () => true);
    const { store } = fakeStore({ stop });
    expect(await stopTextConsent({ ...stopInput, phone: "12345" }, deps(store))).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await stopTextConsent("junk", deps(store))).toEqual({ ok: false, reason: "invalid" });
    expect(
      await stopTextConsent(
        stopInput,
        deps(store, () => false),
      ),
    ).toEqual({ ok: false, reason: "busy" });
    expect(stop).not.toHaveBeenCalled();
  });

  it("says it did not go through when the write fails or throws, never that it stopped", async () => {
    expect(
      await stopTextConsent(stopInput, deps(fakeStore({ stop: async () => false }).store)),
    ).toEqual({ ok: false, reason: "unavailable" });
    const thrown = fakeStore({
      stop: async () => {
        throw new Error("+12068675309");
      },
    });
    const answer = await stopTextConsent(stopInput, deps(thrown.store));
    expect(answer).toEqual({ ok: false, reason: "unavailable" });
  });

  it("has friendly copy with no em dash, and never shows the number back", () => {
    expect(JSON.stringify(TEXT_STOP_COPY)).not.toMatch(/[—–!]/);
    expect(TEXT_STOP_COPY.done).toMatch(/^If that number/);
  });
});

/** A stand-in for the database client that records every call, so the tests can read exactly what was asked. */
function fakeDb(
  answers: {
    select?: unknown;
    error?: { code: string } | null;
    firstError?: { code: string };
  } = {},
) {
  const calls: { table: string; verb: string; values?: unknown; filters: string[] }[] = [];
  let failedOnce = false;
  const db = {
    from(table: string) {
      const make = (verb: string, values?: unknown) => {
        const call = { table, verb, values, filters: [] as string[] };
        calls.push(call);
        const result = () => {
          if (answers.firstError && !failedOnce) {
            failedOnce = true;
            return { data: null, error: answers.firstError };
          }
          return { data: answers.select ?? null, error: answers.error ?? null };
        };
        const chain: Record<string, unknown> = {
          eq: (column: string, value: string) => (call.filters.push(`${column}=${value}`), chain),
          is: (column: string, value: null) => (call.filters.push(`${column} is ${value}`), chain),
          maybeSingle: async () => result(),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(result()).then(resolve),
        };
        return chain;
      };
      return {
        select: (columns: string) => make("select", columns),
        update: (values: unknown) => make("update", values),
        insert: async () => ({ error: null }),
      };
    },
    rpc: async () => ({ data: null, error: null }),
  };
  return { db: db as unknown as Parameters<typeof consentRecords>[0], calls };
}

describe("for the sending and reply code", () => {
  const NUMBER = "+12068675309";

  it("finds the number for a picked person only by workspace, person and a live agreement", async () => {
    const { db, calls } = fakeDb({ select: { phone_e164: NUMBER } });
    expect(await consentRecords(db).numberFor(ORG, PERSON)).toBe(NUMBER);
    expect(calls).toEqual([
      {
        table: "message_consents",
        verb: "select",
        values: "phone_e164",
        filters: [`org_id=${ORG}`, `roster_contact_id=${PERSON}`, "revoked_at is null"],
      },
    ]);
  });

  it("gives no number for nobody, a failed read, a malformed stored value or ids that are not ids", async () => {
    expect(await consentRecords(fakeDb({ select: null }).db).numberFor(ORG, PERSON)).toBeNull();
    expect(
      await consentRecords(
        fakeDb({ select: { phone_e164: NUMBER }, error: { code: "PGRST116" } }).db,
      ).numberFor(ORG, PERSON),
    ).toBeNull();
    expect(
      await consentRecords(fakeDb({ select: { phone_e164: "+442079460958" } }).db).numberFor(
        ORG,
        PERSON,
      ),
    ).toBeNull();
    const junk = fakeDb({ select: { phone_e164: NUMBER } });
    expect(await consentRecords(junk.db).numberFor("org_id.is.null", PERSON)).toBeNull();
    expect(await consentRecords(junk.db).numberFor(ORG, "")).toBeNull();
    expect(junk.calls).toEqual([]);
  });

  it("a STOP reply ends every live agreement for that number, in every workspace, with the reason", async () => {
    const { db, calls } = fakeDb();
    expect(await consentRecords(db).stopNumber(NUMBER)).toBe("done");
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      table: "message_consents",
      verb: "update",
      filters: [`phone_e164=${NUMBER}`, "revoked_at is null"],
    });
    expect(calls[0]?.values).toMatchObject({ revoked_reason: "stop_reply" });
    expect(Object.keys(calls[0]?.values as object).sort()).toEqual([
      "revoked_at",
      "revoked_reason",
    ]);
  });

  it("still stops before the reason column exists, without the reason", async () => {
    const { db, calls } = fakeDb({ firstError: { code: "PGRST204" } });
    expect(await consentRecords(db).stopNumber(NUMBER)).toBe("done");
    expect(calls.map((c) => Object.keys(c.values as object))).toEqual([
      ["revoked_at", "revoked_reason"],
      ["revoked_at"],
    ]);
  });

  it("says failed, so nothing is assumed stopped, on a write error or a value that is not a number", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await consentRecords(fakeDb({ error: { code: "57014" } }).db).stopNumber(NUMBER)).toBe(
      "failed",
    );
    expect(spy.mock.calls.flat().join(" ")).not.toMatch(/2068675309/);
    spy.mockRestore();
    const junk = fakeDb();
    expect(await consentRecords(junk.db).stopNumber("STOP")).toBe("failed");
    expect(junk.calls).toEqual([]);
  });

  it("marks a number confirmed only on its live, not yet confirmed agreements", async () => {
    const { db, calls } = fakeDb();
    await consentRecords(db).confirmNumber(NUMBER);
    expect(calls[0]).toMatchObject({
      verb: "update",
      filters: [`phone_e164=${NUMBER}`, "revoked_at is null", "confirmed_at is null"],
    });
    expect(Object.keys(calls[0]?.values as object)).toEqual(["confirmed_at"]);
    const junk = fakeDb();
    await consentRecords(junk.db).confirmNumber("anything typed");
    expect(junk.calls).toEqual([]);
  });

  it("is never reachable from the browser: no server function wraps it, and the page cannot set a confirmation", () => {
    const fns = readFileSync("src/lib/text-consent.functions.ts", "utf8");
    expect(fns).not.toMatch(/consentRecords|numberFor|confirmNumber|stopNumber/);
    const server = readFileSync("src/lib/text-consent.server.ts", "utf8");
    expect(server.slice(0, server.indexOf("export function consentRecords"))).not.toMatch(
      /confirmed_at/,
    );
  });
});

describe("the migration for five firms", () => {
  const sql = readFileSync("supabase/migrations/20261120020000_text_consent_scale.sql", "utf8");
  const bare = sql.replace(/--.*$/gm, "");

  it("allows one live agreement per number in each workspace, and makes the new rule before dropping the old", () => {
    expect(bare).toMatch(
      /create unique index if not exists message_consents_live_phone_org_idx\s+on public\.message_consents \(phone_e164, coalesce\(org_id, '00000000-0000-0000-0000-000000000000'::uuid\)\)\s+where revoked_at is null/,
    );
    expect(bare.indexOf("message_consents_live_phone_org_idx")).toBeLessThan(
      bare.indexOf("drop index if exists public.message_consents_live_phone_idx"),
    );
  });

  it("drops nothing but that one index, and removes no table, column, row or policy", () => {
    expect(bare.match(/\bdrop\b/gi)).toHaveLength(1);
    expect(bare).not.toMatch(
      /\b(truncate|delete from|drop table|drop column|drop policy|alter column|rename)\b/i,
    );
    expect(bare).not.toMatch(/create policy|\bto (anon|authenticated)\b/i);
    expect(sql).not.toMatch(/[—–]/);
  });

  it("can run twice: every statement is guarded or repeatable", () => {
    const statements = bare
      .replace(/\$\$[\s\S]*?\$\$/g, "$$body$$")
      .split(";")
      .map((part) => part.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    const repeatable =
      /^(create unique index if not exists|drop index if exists|alter table public\.(message_consents|roster_contacts) add column if not exists|create or replace function|revoke all on function|grant execute on function)( |$)/;
    for (const statement of statements) expect(statement).toMatch(repeatable);
    expect(statements).toHaveLength(8);
  });

  it("lets only the server run the number swap, which checks the workspace, the window and the old number", () => {
    expect(bare).toMatch(
      /revoke all on function public\.replace_text_consent\(uuid, uuid, text, text, text, text\) from public, anon, authenticated/,
    );
    expect(bare).toMatch(
      /grant execute on function public\.replace_text_consent\(uuid, uuid, text, text, text, text\) to service_role/,
    );
    const body = bare.slice(bare.indexOf("as $$"), bare.lastIndexOf("$$;"));
    expect(body).toMatch(/where id = p_contact and org_id = p_org\s+for update/);
    expect(body).toMatch(/if v_until is null or v_until < now\(\) then\s+return 'closed'/);
    expect(body).toMatch(/revoked_reason = 'number_changed'/);
    expect(body).toMatch(/set number_change_until = null where id = p_contact/);
    // The window check comes before the first write.
    expect(body.indexOf("return 'closed'")).toBeLessThan(
      body.indexOf("update public.message_consents"),
    );
  });

  it("lets nothing but a known reason be stored, and the reasons match the code's", () => {
    expect(bare).toMatch(/revoked_reason in \('stop_reply', 'stop_link', 'number_changed'\)/);
    const server = readFileSync("src/lib/text-consent.server.ts", "utf8");
    expect(server).toContain(
      'export type RevokeReason = "stop_reply" | "stop_link" | "number_changed";',
    );
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
    // One line each for a failed save, tie, number swap, stop, STOP reply and confirmation: an error code only.
    expect(logs).toHaveLength(6);
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

  it("reads a stored row back in one place only: the number for a picked person, for the sender", () => {
    const reads = [...server.matchAll(/from\("message_consents"\)\s*\.select\(([^)]*)\)/g)].map(
      (m) => m[1],
    );
    expect(reads).toEqual(['"phone_e164"']);
    const numberFor = server.slice(
      server.indexOf("async numberFor("),
      server.indexOf("async stopNumber("),
    );
    expect(numberFor).toContain('.eq("org_id", orgId)');
    expect(numberFor).toContain('.eq("roster_contact_id", contactId)');
    expect(numberFor).toContain('.is("revoked_at", null)');
    // The public page's own code, everything before the sender's helpers, never selects from the table.
    expect(server.slice(0, server.indexOf("export function consentRecords"))).not.toMatch(
      /from\("message_consents"\)\s*\.select/,
    );
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

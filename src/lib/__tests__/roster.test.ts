// 19 Nov 2026: the roster, people a firm works with who have no login. The pure rules, the server decisions with a
// fake outside world, and the floors read from the source: admins and leads only, and no phone number anywhere.
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  CONSENT_COLUMNS,
  listRoster,
  requestNumberChange,
  saveRosterContact,
  type ConsentMarkRow,
  type RosterDeps,
  type RosterRow,
} from "@/lib/roster.server";
import {
  canManageRoster,
  changeOpenUntil,
  checkRosterContact,
  filterRoster,
  NUMBER_CHANGE_DAYS,
  rosterChangeInput,
  ROSTER_COPY,
  ROSTER_MAX_CONTACTS,
  rosterLinkPath,
  rosterListInput,
  rosterSaveInput,
  textsStatus,
  type RosterSaveInput,
} from "@/lib/roster-shared";
import { cleanWorkspace } from "@/lib/text-consent-shared";

const ORG = "0000000a-0000-4000-8000-000000000001";
const OTHER_ORG = "0000000b-0000-4000-8000-000000000002";
const DANA = "0000000c-0000-4000-8000-000000000007";
const SECRET_NUMBER = "+12065550142";

const row = (over: Partial<RosterRow> = {}): RosterRow => ({
  id: DANA,
  org_id: ORG,
  full_name: "Dana Whitlock",
  role_title: "Pricing",
  affiliation: "independent",
  firm_name: null,
  ...over,
});

function world(
  over: Partial<RosterDeps> & { role?: string; rows?: RosterRow[]; marks?: ConsentMarkRow[] } = {},
) {
  const rows = over.rows ?? [row()];
  const writes: string[] = [];
  const deps: RosterDeps = {
    caller: async () => ({ profileId: "p1", orgId: ORG, role: over.role ?? "admin" }),
    list: async (orgId) => rows.filter((r) => r.org_id === orgId),
    count: async (orgId) => rows.filter((r) => r.org_id === orgId).length,
    insert: async (orgId, fields) => {
      writes.push("insert");
      const made = row({
        id: "0000000c-0000-4000-8000-0000000000aa",
        org_id: orgId,
        full_name: fields.name,
        role_title: fields.role,
        affiliation: fields.affiliation,
        firm_name: fields.firm,
      });
      rows.push(made);
      return made;
    },
    update: async (orgId, id, fields) => {
      writes.push("update");
      const found = rows.find((r) => r.id === id && r.org_id === orgId);
      if (!found) return "missing";
      Object.assign(found, {
        full_name: fields.name,
        role_title: fields.role,
        affiliation: fields.affiliation,
        firm_name: fields.firm,
      });
      return found;
    },
    one: async (orgId, id) => rows.find((r) => r.id === id && r.org_id === orgId) ?? "missing",
    openChange: async (orgId, id, until) => {
      writes.push("openChange");
      const found = rows.find((r) => r.id === id && r.org_id === orgId);
      if (!found) return "missing";
      found.number_change_until = until;
      return found;
    },
    consents: async (_orgId, ids) =>
      (over.marks ?? []).filter((m) => ids.includes(m.roster_contact_id)),
    ...over,
  };
  return { deps, rows, writes };
}
const input = (over: Partial<RosterSaveInput> = {}): RosterSaveInput => ({
  profile_id: null,
  id: null,
  name: "Tomás Ó Briain-Lee",
  role: "Health economics",
  affiliation: "firm",
  firm: "St. Brigid Partners",
  ...over,
});

describe("who may manage the roster", () => {
  it("is admins and leads, nobody else", () => {
    expect(["admin", "lead"].every(canManageRoster)).toBe(true);
    for (const role of ["em", "manager", "analyst", "coach", "guest", "", null, undefined])
      expect(canManageRoster(role)).toBe(false);
  });
});

describe("checkRosterContact", () => {
  it("keeps accents, hyphens and short firm names, and tidies space", () => {
    expect(
      checkRosterContact({
        name: "  Tomás   Ó Briain-Lee ",
        role: " Pricing ",
        affiliation: "firm",
        firm: "St. Brigid",
      }),
    ).toEqual({
      ok: true,
      fields: {
        name: "Tomás Ó Briain-Lee",
        role: "Pricing",
        affiliation: "firm",
        firm: "St. Brigid",
      },
    });
  });

  it("lets the role be empty, and drops a firm name left behind for someone independent", () => {
    expect(
      checkRosterContact({
        name: "Dana",
        role: "  ",
        affiliation: "independent",
        firm: "Old Firm",
      }),
    ).toEqual({
      ok: true,
      fields: { name: "Dana", role: null, affiliation: "independent", firm: null },
    });
  });

  it("names every problem at once", () => {
    expect(
      checkRosterContact({
        name: " ",
        role: "x".repeat(121),
        affiliation: "contractor",
        firm: "y".repeat(121),
      }),
    ).toEqual({ ok: false, problems: ["name", "role", "affiliation", "firm"] });
    expect(checkRosterContact(null)).toEqual({ ok: false, problems: ["name", "affiliation"] });
  });

  it("needs a firm's name for someone at a firm", () => {
    expect(checkRosterContact({ name: "Dana", affiliation: "firm", firm: "" })).toEqual({
      ok: false,
      problems: ["firm"],
    });
  });

  it("refuses wrong types and overlong names, and strips control characters", () => {
    expect(checkRosterContact({ name: 7, affiliation: "independent" })).toMatchObject({
      ok: false,
    });
    expect(checkRosterContact({ name: "n".repeat(121), affiliation: "independent" })).toMatchObject(
      { ok: false, problems: ["name"] },
    );
    expect(
      checkRosterContact({ name: "Dana", role: { a: 1 }, affiliation: "independent" }),
    ).toMatchObject({ ok: false, problems: ["role"] });
    expect(
      checkRosterContact({ name: "Da\u0000na\n", role: "a\tb", affiliation: "independent" }),
    ).toMatchObject({ ok: true, fields: { name: "Da na", role: "a b" } });
  });

  it("keeps markup as plain text; the page renders it as text", () => {
    const check = checkRosterContact({
      name: "<img src=x onerror=alert(1)>",
      affiliation: "independent",
    });
    expect(check).toMatchObject({ ok: true, fields: { name: "<img src=x onerror=alert(1)>" } });
  });
});

describe("textsStatus", () => {
  const at = "2026-11-19T23:21:48.464097+00:00";
  const none = { agreedOn: null, stoppedOn: null, confirmed: false };
  it("says agreed with the day for a live agreement, whatever was stopped before", () => {
    expect(
      textsStatus([
        { agreed_at: "2026-10-01T00:00:00Z", revoked_at: "2026-10-02T00:00:00Z" },
        { agreed_at: at, revoked_at: null },
      ]),
    ).toEqual({ texts: "agreed", agreedOn: "2026-11-19", stoppedOn: null, confirmed: false });
  });
  it("says stopped with the latest day, none when there is nothing, unknown when the read failed", () => {
    expect(
      textsStatus([
        { agreed_at: "2026-10-01T00:00:00Z", revoked_at: "2026-10-02T00:00:00Z" },
        { agreed_at: at, revoked_at: "2026-11-20T08:00:00Z" },
      ]),
    ).toEqual({ texts: "stopped", agreedOn: null, stoppedOn: "2026-11-20", confirmed: false });
    expect(textsStatus([])).toEqual({ texts: "none", ...none });
    expect(textsStatus(null)).toEqual({ texts: "unknown", ...none });
  });
  it("gives no day rather than a wrong one when the date is missing or odd", () => {
    expect(textsStatus([{ agreed_at: null, revoked_at: null }])).toEqual({
      texts: "agreed",
      ...none,
    });
    expect(textsStatus([{ agreed_at: "yesterday", revoked_at: null }])).toEqual({
      texts: "agreed",
      ...none,
    });
    expect(textsStatus([{ agreed_at: at, revoked_at: "soon" }])).toEqual({
      texts: "stopped",
      ...none,
    });
  });
  it("is confirmed only when the live agreement carries a real confirmation date", () => {
    expect(textsStatus([{ agreed_at: at, revoked_at: null, confirmed_at: at }]).confirmed).toBe(
      true,
    );
    expect(textsStatus([{ agreed_at: at, revoked_at: null, confirmed_at: null }]).confirmed).toBe(
      false,
    );
    expect(textsStatus([{ agreed_at: at, revoked_at: null }]).confirmed).toBe(false);
    expect(textsStatus([{ agreed_at: at, revoked_at: null, confirmed_at: "true" }]).confirmed).toBe(
      false,
    );
    // A confirmation on an agreement that has since ended says nothing about the live one.
    expect(
      textsStatus([
        { agreed_at: "2026-10-01T00:00:00Z", revoked_at: "2026-10-02T00:00:00Z", confirmed_at: at },
        { agreed_at: at, revoked_at: null },
      ]).confirmed,
    ).toBe(false);
    expect(textsStatus([{ agreed_at: at, revoked_at: at, confirmed_at: at }]).confirmed).toBe(
      false,
    );
  });
});

describe("changeOpenUntil and filterRoster", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  it("gives the closing day only for a window still open", () => {
    expect(changeOpenUntil("2026-11-27T12:00:00Z", now)).toBe("2026-11-27");
    expect(changeOpenUntil("2026-11-20T11:59:59Z", now)).toBeNull();
    for (const odd of [null, undefined, "", "next week"])
      expect(changeOpenUntil(odd, now)).toBeNull();
  });

  const people = [
    { name: "Tomás Ó Briain-Lee", role: "Health economics", firm: "St. Brigid Partners" },
    { name: "Dana Whitlock", role: "Pricing", firm: null },
    { name: "Eli Zhang", role: null, firm: "Brigid & Co" },
  ];
  it("matches every word typed against name, role and firm, ignoring case and accents", () => {
    expect(filterRoster(people, "tomas").map((p) => p.name)).toEqual(["Tomás Ó Briain-Lee"]);
    expect(filterRoster(people, "BRIGID").map((p) => p.name)).toEqual([
      "Tomás Ó Briain-Lee",
      "Eli Zhang",
    ]);
    expect(filterRoster(people, "brigid health").map((p) => p.name)).toEqual([
      "Tomás Ó Briain-Lee",
    ]);
    expect(filterRoster(people, "pricing dana")).toHaveLength(1);
    expect(filterRoster(people, "nobody")).toEqual([]);
  });
  it("shows everyone for an empty or blank search, and treats pattern characters as plain text", () => {
    expect(filterRoster(people, "   ")).toHaveLength(3);
    expect(filterRoster(people, ".*")).toEqual([]);
    expect(filterRoster(people, "st.")).toHaveLength(1);
  });
});

describe("the link and the input shapes", () => {
  it("builds a link the public page accepts for both ids", () => {
    const path = rosterLinkPath(ORG, DANA);
    expect(path).toBe(`/texts?w=${ORG}&c=${DANA}`);
    const query = new URLSearchParams(path.split("?")[1]);
    expect(cleanWorkspace(query.get("w"))).toBe(ORG);
    expect(cleanWorkspace(query.get("c"))).toBe(DANA);
  });

  it("cuts oversize input and turns junk ids into none", () => {
    expect(rosterListInput("junk")).toEqual({ profile_id: null });
    expect(rosterListInput({ profile_id: ORG.toUpperCase() })).toEqual({ profile_id: ORG });
    const shaped = rosterSaveInput({
      id: "1; drop table",
      name: "n".repeat(5000),
      role: 9,
      affiliation: "firm".repeat(20),
      firm: null,
      phone: SECRET_NUMBER,
      org_id: OTHER_ORG,
    });
    expect(shaped).toEqual({
      profile_id: null,
      id: null,
      name: "n".repeat(400),
      role: "",
      affiliation: "firmfirmfirmfirmfirm",
      firm: "",
    });
  });

  it("has no em dash and never asks for a number in its copy", () => {
    const copy =
      JSON.stringify(ROSTER_COPY) +
      ROSTER_COPY.editLabel("x") +
      ROSTER_COPY.copyLabel("x") +
      ROSTER_COPY.linkLabel("x") +
      ROSTER_COPY.agreedOn("x");
    expect(copy).not.toMatch(/[—–]/);
    expect(ROSTER_COPY.failures.full).toContain(String(ROSTER_MAX_CONTACTS));
  });
});

describe("listRoster", () => {
  it("gives an admin and a lead their workspace's people, each with one word for texts and their own link", async () => {
    for (const role of ["admin", "lead"]) {
      const { deps } = world({
        role,
        marks: [{ roster_contact_id: DANA, agreed_at: "2026-11-19T23:21:48Z", revoked_at: null }],
      });
      expect(await listRoster(deps)).toEqual({
        allowed: true,
        contacts: [
          {
            id: DANA,
            name: "Dana Whitlock",
            role: "Pricing",
            affiliation: "independent",
            firm: null,
            texts: "agreed",
            agreedOn: "2026-11-19",
            stoppedOn: null,
            confirmed: false,
            changeUntil: null,
            linkPath: `/texts?w=${ORG}&c=${DANA}`,
          },
        ],
      });
    }
  });

  it("gives every other role nothing, and reads nothing for them", async () => {
    for (const role of ["em", "manager", "analyst", "coach", "guest"]) {
      const list = vi.fn(async () => [row()]);
      const consents = vi.fn(async () => []);
      expect(await listRoster(world({ role, list, consents }).deps)).toEqual({ allowed: false });
      expect(list).not.toHaveBeenCalled();
      expect(consents).not.toHaveBeenCalled();
    }
  });

  it("passes on the refusal for someone who is not a member of a company workspace", async () => {
    const refused = new Response("Forbidden", { status: 403 });
    await expect(
      listRoster(
        world({
          caller: async () => {
            throw refused;
          },
        }).deps,
      ),
    ).rejects.toBe(refused);
  });

  it("never shows a row from another workspace, whatever the read returned", async () => {
    const { deps } = world({
      list: async () => [
        row(),
        row({
          id: "0000000c-0000-4000-8000-0000000000bb",
          org_id: OTHER_ORG,
          full_name: "Leaked Person",
        }),
      ],
    });
    const list = await listRoster(deps);
    expect(JSON.stringify(list)).not.toContain("Leaked");
    expect(list).toMatchObject({ contacts: [{ id: DANA }] });
  });

  it("says the list did not load rather than showing an empty one", async () => {
    await expect(listRoster(world({ list: async () => null }).deps)).rejects.toMatchObject({
      status: 503,
    });
  });

  it("shows people with texts 'unknown' when agreements cannot be read, never 'none'", async () => {
    for (const consents of [async () => null, async () => Promise.reject(new Error("down"))]) {
      expect(await listRoster(world({ consents }).deps)).toMatchObject({
        contacts: [{ id: DANA, texts: "unknown", agreedOn: null }],
      });
    }
  });

  it("does not read agreements for an empty roster", async () => {
    const consents = vi.fn(async () => []);
    expect(await listRoster(world({ rows: [], consents }).deps)).toEqual({
      allowed: true,
      contacts: [],
    });
    expect(consents).not.toHaveBeenCalled();
  });

  it("never carries a number, even when the outside world hands one over", async () => {
    const leaky = [
      {
        roster_contact_id: DANA,
        agreed_at: "2026-11-19T00:00:00Z",
        revoked_at: null,
        phone_e164: SECRET_NUMBER,
      },
    ] as unknown as ConsentMarkRow[];
    const answer = JSON.stringify(
      await listRoster(
        world({
          consents: async () => leaky,
          rows: [{ ...row(), phone_e164: SECRET_NUMBER } as RosterRow],
        }).deps,
      ),
    );
    expect(answer).not.toMatch(/2065550142|phone/);
  });
});

describe("saveRosterContact", () => {
  it("adds a person for an admin and a lead, in the caller's own workspace", async () => {
    for (const role of ["admin", "lead"]) {
      const { deps, rows } = world({ role, rows: [] });
      const result = await saveRosterContact(deps, input());
      expect(result).toMatchObject({
        ok: true,
        contact: {
          name: "Tomás Ó Briain-Lee",
          role: "Health economics",
          affiliation: "firm",
          firm: "St. Brigid Partners",
          texts: "none",
        },
      });
      expect(rows).toEqual([expect.objectContaining({ org_id: ORG })]);
    }
  });

  it("refuses every other role with a 403 before any read or write", async () => {
    for (const role of ["em", "manager", "analyst", "coach", "guest"]) {
      const { deps, writes } = world({ role });
      const count = vi.spyOn(deps, "count");
      await expect(saveRosterContact(deps, input())).rejects.toMatchObject({ status: 403 });
      await expect(saveRosterContact(deps, input({ id: DANA }))).rejects.toMatchObject({
        status: 403,
      });
      expect(writes).toEqual([]);
      expect(count).not.toHaveBeenCalled();
    }
  });

  it("refuses bad fields, names them, and writes nothing", async () => {
    const { deps, writes } = world();
    expect(
      await saveRosterContact(deps, input({ name: " ", affiliation: "firm", firm: "" })),
    ).toEqual({ ok: false, reason: "invalid", problems: ["name", "firm"] });
    expect(writes).toEqual([]);
  });

  it("corrects a person, and keeps their text agreement word", async () => {
    const { deps, rows } = world({
      marks: [{ roster_contact_id: DANA, agreed_at: "2026-11-19T00:00:00Z", revoked_at: null }],
    });
    const result = await saveRosterContact(
      deps,
      input({
        id: DANA,
        name: "Dana Whitlock-Reyes",
        affiliation: "independent",
        firm: "left over",
      }),
    );
    expect(result).toMatchObject({
      ok: true,
      contact: {
        id: DANA,
        name: "Dana Whitlock-Reyes",
        affiliation: "independent",
        firm: null,
        texts: "agreed",
      },
    });
    expect(rows[0]).toMatchObject({ full_name: "Dana Whitlock-Reyes", firm_name: null });
  });

  it("answers 'missing' for an id in another workspace and changes nothing there", async () => {
    const theirs = row({
      id: "0000000c-0000-4000-8000-0000000000bb",
      org_id: OTHER_ORG,
      full_name: "Not Yours",
    });
    const { deps, rows } = world({ rows: [row(), theirs] });
    expect(await saveRosterContact(deps, input({ id: theirs.id }))).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(rows[1]).toMatchObject({ full_name: "Not Yours", org_id: OTHER_ORG });
  });

  it("stops at the limit, and does not add when the count cannot be read", async () => {
    const full = world({ count: async () => ROSTER_MAX_CONTACTS });
    expect(await saveRosterContact(full.deps, input())).toEqual({ ok: false, reason: "full" });
    const blind = world({ count: async () => null });
    expect(await saveRosterContact(blind.deps, input())).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect([...full.writes, ...blind.writes]).toEqual([]);
  });

  it("says it did not save when the write fails or throws, never that it worked", async () => {
    expect(await saveRosterContact(world({ insert: async () => null }).deps, input())).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(
      await saveRosterContact(world({ update: async () => null }).deps, input({ id: DANA })),
    ).toEqual({ ok: false, reason: "unavailable" });
    const thrown = world({
      insert: async () => {
        throw new Error(`Key (full_name)=(Tomás) ${SECRET_NUMBER}`);
      },
    });
    const answer = await saveRosterContact(thrown.deps, input());
    expect(answer).toEqual({ ok: false, reason: "unavailable" });
  });

  it("still saves a correction when agreements cannot be read, with texts 'unknown'", async () => {
    const { deps } = world({ consents: async () => null });
    expect(await saveRosterContact(deps, input({ id: DANA }))).toMatchObject({
      ok: true,
      contact: { texts: "unknown" },
    });
  });

  it("never takes the workspace from the request", async () => {
    const { deps, rows } = world({ rows: [] });
    await saveRosterContact(deps, { ...input(), org_id: OTHER_ORG } as RosterSaveInput);
    expect(rows[0]?.org_id).toBe(ORG);
  });
});

describe("requestNumberChange", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const agreed: ConsentMarkRow[] = [
    { roster_contact_id: DANA, agreed_at: "2026-11-19T00:00:00Z", revoked_at: null },
  ];
  const ask = { profile_id: null, id: DANA };

  it("opens a seven day window for an admin and a lead, on a person with a live agreement", async () => {
    for (const role of ["admin", "lead"]) {
      const { deps, rows, writes } = world({ role, marks: agreed });
      expect(await requestNumberChange(deps, ask, now)).toMatchObject({
        ok: true,
        contact: { id: DANA, texts: "agreed", changeUntil: "2026-11-27" },
      });
      expect(rows[0]?.number_change_until).toBe("2026-11-27T12:00:00.000Z");
      expect(writes).toEqual(["openChange"]);
      expect(NUMBER_CHANGE_DAYS).toBe(7);
    }
  });

  it("refuses every other role with a 403 before any read or write", async () => {
    for (const role of ["em", "manager", "analyst", "coach", "guest"]) {
      const { deps, writes } = world({ role, marks: agreed });
      const one = vi.spyOn(deps, "one");
      await expect(requestNumberChange(deps, ask, now)).rejects.toMatchObject({ status: 403 });
      expect(one).not.toHaveBeenCalled();
      expect(writes).toEqual([]);
    }
  });

  it("answers 'missing' for no id and for a person in another workspace, and opens nothing there", async () => {
    const theirs = row({ id: "0000000c-0000-4000-8000-0000000000bb", org_id: OTHER_ORG });
    const { deps, rows, writes } = world({
      rows: [row(), theirs],
      marks: [
        { roster_contact_id: theirs.id, agreed_at: "2026-11-19T00:00:00Z", revoked_at: null },
      ],
    });
    expect(await requestNumberChange(deps, { profile_id: null, id: theirs.id }, now)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(await requestNumberChange(deps, { profile_id: null, id: null }, now)).toEqual({
      ok: false,
      reason: "missing",
    });
    expect(rows[1]?.number_change_until).toBeUndefined();
    expect(writes).toEqual([]);
  });

  it("opens nothing for someone with no live agreement, or one that was stopped", async () => {
    const stopped: ConsentMarkRow[] = [
      {
        roster_contact_id: DANA,
        agreed_at: "2026-11-01T00:00:00Z",
        revoked_at: "2026-11-02T00:00:00Z",
      },
    ];
    for (const marks of [[], stopped]) {
      const { deps, writes } = world({ marks });
      expect(await requestNumberChange(deps, ask, now)).toEqual({
        ok: false,
        reason: "not_agreed",
      });
      expect(writes).toEqual([]);
    }
  });

  it("opens nothing on a guess: a failed read or write says it did not go through", async () => {
    for (const over of [
      { consents: async () => null },
      { one: async () => null },
      { openChange: async () => null },
    ] as Partial<RosterDeps>[]) {
      expect(await requestNumberChange(world({ marks: agreed, ...over }).deps, ask, now)).toEqual({
        ok: false,
        reason: "unavailable",
      });
    }
    const thrown = world({
      marks: agreed,
      openChange: async () => {
        throw new Error(SECRET_NUMBER);
      },
    });
    expect(await requestNumberChange(thrown.deps, ask, now)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("shows the window on the list while it is open, and not once it has passed", async () => {
    const open = world({ rows: [row({ number_change_until: "2099-01-08T00:00:00Z" })] });
    expect(await listRoster(open.deps)).toMatchObject({
      contacts: [{ changeUntil: "2099-01-08" }],
    });
    const past = world({ rows: [row({ number_change_until: "2020-01-01T00:00:00Z" })] });
    expect(await listRoster(past.deps)).toMatchObject({ contacts: [{ changeUntil: null }] });
  });
});

describe("the floors, read from the source", () => {
  const server = readFileSync("src/lib/roster.server.ts", "utf8");
  const shared = readFileSync("src/lib/roster-shared.ts", "utf8");
  const fns = readFileSync("src/lib/roster.functions.ts", "utf8");
  const panel = readFileSync("src/components/roster/RosterPanel.tsx", "utf8");
  const sql = readFileSync("supabase/migrations/20261120000000_roster_contacts.sql", "utf8");
  const code = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");

  it("asks message_consents for the person and three dates only, never the number or the name", () => {
    expect(CONSENT_COLUMNS).toBe("roster_contact_id, agreed_at, revoked_at, confirmed_at");
    expect(server).toContain(
      'const BASE_CONSENT_COLUMNS = "roster_contact_id, agreed_at, revoked_at";',
    );
    // One place touches the table, it only selects, and only with one of those two column lists.
    const touches = [...server.matchAll(/from\("message_consents"\)\s*\.(\w+)\(([^)]*)\)/g)];
    expect(touches.map((m) => `${m[1]}(${m[2]})`)).toEqual(["select(columns)"]);
    expect(server.match(/read\((\w+)\)/g)).toEqual([
      "read(CONSENT_COLUMNS)",
      "read(BASE_CONSENT_COLUMNS)",
    ]);
    expect(code(server) + code(shared) + code(fns) + code(panel)).not.toMatch(
      /phone_|e164|\.phone\b|\bphone\s*[:=]|select\("\*"\)/i,
    );
  });

  it("records no event, and logs an error code only", () => {
    for (const source of [server, shared, fns, panel])
      expect(source).not.toMatch(/recordEvent|logEvent|posthog|trackEvent/);
    const logs = [...server.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toMatch(/message|details|row|fields|name|data/i);
    expect(server.match(/logFailure\("[a-z ]+", error\)/g)).toHaveLength(
      server.match(/logFailure\(/g)!.length - 1,
    );
    expect(shared + fns + panel).not.toMatch(/console\./);
  });

  it("puts sign-in in front of all three functions and takes no workspace or number from the browser", () => {
    expect(fns.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)).toHaveLength(3);
    expect(fns.match(/createServerFn\(/g)).toHaveLength(3);
    expect(
      Object.keys(
        rosterChangeInput({ id: DANA, profile_id: ORG, phone: SECRET_NUMBER, until: "2099-01-01" }),
      ),
    ).toEqual(["profile_id", "id"]);
    expect(code(shared)).not.toMatch(/org_id|orgId: text|raw\["org/);
    expect(server).toMatch(/requireFirmMember\(/);
  });

  it("scopes every roster write and read to the caller's workspace", () => {
    const real = server.slice(server.indexOf("export async function realDeps"));
    const calls = real.split('.from("roster_contacts")').slice(1);
    expect(calls).toHaveLength(6);
    for (const call of calls)
      expect(call.slice(0, call.indexOf(";"))).toMatch(/\.eq\("org_id", orgId\)|org_id: orgId/);
    expect(real).not.toMatch(/\.delete\(/);
  });

  it("shuts the table to every browser role", () => {
    expect(sql).toMatch(/alter table public\.roster_contacts enable row level security/);
    expect(sql).toMatch(
      /revoke all on table public\.roster_contacts from public, anon, authenticated/,
    );
    expect(sql).not.toMatch(/create policy/i);
    expect(sql).not.toMatch(/\bto (anon|authenticated)\b/);
    expect(sql).toMatch(
      /revoke all on function public\.roster_contacts_guard\(\) from public, anon, authenticated/,
    );
  });

  it("holds no number or email column, and only adds", () => {
    const table = sql.slice(sql.indexOf("create table"), sql.indexOf(");"));
    expect(table).not.toMatch(/phone|e164|email|mobile/i);
    expect(sql).not.toMatch(
      /\b(truncate|delete from|drop table|drop column|drop index|drop policy|alter column|rename)\b/i,
    );
    // The one drop is the trigger this same file creates, so the file can run twice.
    expect(sql.replace(/--.*$/gm, "").match(/\bdrop\b/gi)).toHaveLength(1);
    expect(sql).toMatch(
      /drop trigger if exists roster_contacts_t_guard on public\.roster_contacts;\s*create trigger roster_contacts_t_guard/,
    );
    expect(sql).not.toMatch(/[—–]/);
  });

  it("can run twice: every statement is guarded or repeatable", () => {
    const statements = sql
      .replace(/--.*$/gm, "")
      .replace(/\$\$[\s\S]*?\$\$/g, "$$body$$")
      .split(";")
      .map((s) => s.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    const repeatable =
      /^(create table if not exists|create (unique )?index if not exists|create or replace function|drop trigger if exists|create trigger roster_contacts_t_guard|alter table public\.roster_contacts enable row level security|revoke all on|grant select, insert, update on|comment on table|alter table public\.message_consents add column if not exists)( |$)/;
    for (const statement of statements) expect(statement).toMatch(repeatable);
    expect(statements).toHaveLength(12);
  });

  it("matches the page's rules: lengths, the two kinds, and a firm name only for a firm", () => {
    expect(sql).toMatch(/char_length\(full_name\) between 1 and 120/);
    expect(sql).toMatch(/affiliation in \('independent', 'firm'\)/);
    expect(sql).toMatch(/\(affiliation = 'firm'\) = \(firm_name is not null\)/);
  });

  it("ties an agreement to at most one live number per person, and keeps the agreement if the person is removed", () => {
    expect(sql).toMatch(
      /add column if not exists roster_contact_id uuid references public\.roster_contacts\(id\) on delete set null/,
    );
    expect(sql).toMatch(
      /create unique index if not exists message_consents_live_contact_idx\s+on public\.message_consents \(roster_contact_id\)\s+where roster_contact_id is not null and revoked_at is null/,
    );
  });
});

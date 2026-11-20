// 19 Nov 2026: the roster, people a firm works with who have no login. The pure rules, the server decisions with a
// fake outside world, and the floors read from the source: admins and leads only. Since 20 Nov an add needs a mobile
// number and an email; the full number never comes back, and typing one never lets a text go.
import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import {
  CONSENT_COLUMNS,
  DETAIL_COLUMNS,
  INVITE_GAP_MS,
  listRoster,
  requestNumberChange,
  rosterInviteEmail,
  saveRosterContact,
  sendRosterInvite,
  type ConsentMarkRow,
  type DetailRow,
  type RosterDeps,
  type RosterRow,
} from "@/lib/roster.server";
import {
  canManageRoster,
  changeOpenUntil,
  checkRosterContact,
  checkRosterDetails,
  cleanEmail,
  cleanLinkedin,
  filterRoster,
  maskPhone,
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

const NEW_ID = "0000000c-0000-4000-8000-0000000000aa";
const detail = (over: Partial<DetailRow> = {}): DetailRow => ({
  roster_contact_id: DANA,
  phone_e164: SECRET_NUMBER,
  email: "dana@example.test",
  linkedin_url: null,
  invite_sent_at: null,
  ...over,
});

function world(
  over: Partial<RosterDeps> & {
    role?: string;
    rows?: RosterRow[];
    marks?: ConsentMarkRow[];
    stored?: DetailRow[];
    differing?: string[];
  } = {},
) {
  const rows = over.rows ?? [row()];
  const stored = over.stored ?? [];
  const writes: string[] = [];
  const sent: unknown[] = [];
  const deps: RosterDeps = {
    caller: async () => ({ profileId: "p1", orgId: ORG, role: over.role ?? "admin" }),
    list: async (orgId) => rows.filter((r) => r.org_id === orgId),
    // The database function's own rules: nothing is written before a refusal, and an add needs both details.
    saveAll: async (orgId, id, fields, details) => {
      if (!id) {
        if (!details?.phone || !details.email) return "details";
        if (rows.filter((r) => r.org_id === orgId).length >= ROSTER_MAX_CONTACTS) return "full";
        writes.push("saveAll");
        rows.push(
          row({
            id: NEW_ID,
            org_id: orgId,
            full_name: fields.name,
            role_title: fields.role,
            affiliation: fields.affiliation,
            firm_name: fields.firm,
          }),
        );
        stored.push(
          detail({
            roster_contact_id: NEW_ID,
            phone_e164: details.phone,
            email: details.email,
            linkedin_url: details.linkedin,
          }),
        );
        return { id: NEW_ID };
      }
      const found = rows.find((r) => r.id === id && r.org_id === orgId);
      if (!found) return "missing";
      const has = stored.find((d) => d.roster_contact_id === id);
      if (details && !has && !details.phone) return "details";
      writes.push("saveAll");
      Object.assign(found, {
        full_name: fields.name,
        role_title: fields.role,
        affiliation: fields.affiliation,
        firm_name: fields.firm,
      });
      if (details && has)
        Object.assign(has, {
          phone_e164: details.phone ?? has.phone_e164,
          email: details.email,
          linkedin_url: details.linkedin,
        });
      else if (details)
        stored.push(
          detail({
            roster_contact_id: id,
            phone_e164: details.phone as string,
            email: details.email,
            linkedin_url: details.linkedin,
          }),
        );
      return { id };
    },
    details: async (orgId, ids) =>
      stored.filter(
        (d) =>
          ids.includes(d.roster_contact_id) &&
          rows.some((r) => r.id === d.roster_contact_id && r.org_id === orgId),
      ),
    differs: async () => over.differing ?? [],
    workspaceName: async () => "Kestrel Bay Advisory",
    sendInvite: async (mail) => {
      sent.push(mail);
      return "sent";
    },
    markInvited: async (_orgId, id, at) => {
      writes.push("markInvited");
      const has = stored.find((d) => d.roster_contact_id === id);
      if (has) has.invite_sent_at = at;
      return true;
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
  return { deps, rows, writes, stored, sent };
}
const input = (over: Partial<RosterSaveInput> = {}): RosterSaveInput => ({
  profile_id: null,
  id: null,
  name: "Tomás Ó Briain-Lee",
  role: "Health economics",
  affiliation: "firm",
  firm: "St. Brigid Partners",
  phone: "(206) 555-0142",
  email: "Tomas@Example.test",
  linkedin: "",
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
      phone: SECRET_NUMBER,
      email: "",
      linkedin: "",
    });
  });

  it("has no em dash in its copy, and says the typed number is for contact only", () => {
    expect(ROSTER_COPY.dialog.description).toMatch(/for contact only/);
    expect(ROSTER_COPY.dialog.description).toMatch(/only after they agree on their own link/);
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
            phoneMasked: null,
            email: null,
            linkedin: null,
            needsDetails: true,
            numberDiffers: false,
            invitedOn: null,
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
    expect(answer).not.toMatch(/2065550142|phone_e164/);
  });

  it("shows details to an admin and a lead with the number masked, and never the full number", async () => {
    for (const role of ["admin", "lead"]) {
      const list = await listRoster(
        world({
          role,
          stored: [
            detail({
              linkedin_url: "https://www.linkedin.com/in/dana",
              invite_sent_at: "2026-11-20T09:00:00Z",
            }),
          ],
        }).deps,
      );
      expect(list).toMatchObject({
        contacts: [
          {
            phoneMasked: "(•••) •••-0142",
            email: "dana@example.test",
            linkedin: "https://www.linkedin.com/in/dana",
            needsDetails: false,
            invitedOn: "2026-11-20",
          },
        ],
      });
      expect(JSON.stringify(list)).not.toMatch(/206555|\+1206/);
    }
  });

  it("gives every other role no details at all, and never reads them", async () => {
    for (const role of ["em", "manager", "analyst", "coach", "guest"]) {
      const details = vi.fn(async () => [detail()]);
      const answer = await listRoster(world({ role, details }).deps);
      expect(answer).toEqual({ allowed: false });
      expect(details).not.toHaveBeenCalled();
      expect(JSON.stringify(answer)).not.toMatch(/example\.test|0142|linkedin/);
    }
  });

  it("never shows another workspace's details, whatever the read returned", async () => {
    const theirs = row({ id: "0000000c-0000-4000-8000-0000000000bb", org_id: OTHER_ORG });
    const leaky = [detail({ roster_contact_id: theirs.id, email: "theirs@example.test" })];
    const answer = JSON.stringify(
      await listRoster(world({ rows: [row(), theirs], details: async () => leaky }).deps),
    );
    expect(answer).not.toMatch(/theirs@example\.test/);
  });

  it("marks people from before as needing details, and guesses nothing when details cannot be read", async () => {
    const before = await listRoster(world().deps);
    expect(before).toMatchObject({ contacts: [{ needsDetails: true, email: null }] });
    for (const details of [
      async () => null,
      async () => "absent" as const,
      async () => Promise.reject(new Error("x")),
    ]) {
      expect(await listRoster(world({ details }).deps)).toMatchObject({
        allowed: true,
        contacts: [{ needsDetails: false, phoneMasked: null, email: null }],
      });
    }
  });

  it("says when the agreed number is not the one on file, only for a person with details", async () => {
    const yes = await listRoster(world({ stored: [detail()], differing: [DANA] }).deps);
    expect(yes).toMatchObject({ contacts: [{ numberDiffers: true }] });
    const noDetails = await listRoster(world({ differing: [DANA] }).deps);
    expect(noDetails).toMatchObject({ contacts: [{ numberDiffers: false }] });
    const unknown = await listRoster(world({ stored: [detail()], differs: async () => null }).deps);
    expect(unknown).toMatchObject({ contacts: [{ numberDiffers: false }] });
  });
});

describe("contact detail rules", () => {
  it("accepts emails people really have and stores them lower case", () => {
    expect(cleanEmail("  Tomas.O'Briain+bids@St-Brigid.example  ")).toBe(
      "tomas.o'briain+bids@st-brigid.example",
    );
    expect(cleanEmail("dana.o'brien@example.test")).toBe("dana.o'brien@example.test");
    expect(cleanEmail("dana@o'brien.example.test")).toBeNull();
    expect(cleanEmail("Tomas.OBriain+bids@St-Brigid.Example")).toBe(
      "tomas.obriain+bids@st-brigid.example",
    );
    for (const bad of [
      "",
      "dana",
      "dana@",
      "@example.test",
      "dana@example",
      "a b@example.test",
      "dana@@example.test",
      "dana@example.test, eli@example.test",
      `${"a".repeat(250)}@example.test`,
      null,
      7,
    ])
      expect(cleanEmail(bad)).toBeNull();
  });

  it("refuses an email holding an invisible or control character", () => {
    for (const hidden of [
      "\u200B",
      "\u200D",
      "\u2060",
      "\uFEFF",
      "\u0085",
      "\u0000",
      "\u0007",
      "\u00AD",
      "\u202E",
    ]) {
      expect(cleanEmail(`a${hidden}b@example.test`)).toBeNull();
      expect(cleanEmail(`ab@exa${hidden}mple.test`)).toBeNull();
    }
    expect(cleanEmail("ab@example.test")).toBe("ab@example.test");
  });

  it("the email hint promises only what exists, and the edit form's opening line fits an edit", () => {
    expect(ROSTER_COPY.dialog.emailHint).toBe("For reaching them.");
    expect(ROSTER_COPY.dialog.editDescription).not.toContain("to add someone");
    expect(ROSTER_COPY.dialog.editDescription).toContain("only after they agree on their own link");
    expect(ROSTER_COPY.dialog.description).toContain("are needed to add someone");
  });

  it("accepts a LinkedIn address the ways people paste one, and no other site", () => {
    for (const typed of [
      "linkedin.com/in/dana-w",
      "www.linkedin.com/in/dana-w/",
      "https://www.linkedin.com/in/dana-w?utm=x#top",
      "http://linkedin.com/in/dana-w",
    ])
      expect(cleanLinkedin(typed)).toBe("https://www.linkedin.com/in/dana-w");
    expect(cleanLinkedin("uk.linkedin.com/in/dana-w")).toBe("https://uk.linkedin.com/in/dana-w");
    for (const bad of [
      "",
      "linkedin.com",
      "https://linkedin.com/",
      "https://evil.example/in/dana",
      "https://linkedin.com.evil.example/in/x",
      "https://notlinkedin.com/in/x",
      "javascript:alert(1)",
      "https://user:pw@linkedin.com/in/x",
      "linkedin.com/in/a b",
      `linkedin.com/in/${"a".repeat(300)}`,
      null,
    ])
      expect(cleanLinkedin(bad)).toBeNull();
  });

  it("masks a number to its last four digits, and anything else to nothing", () => {
    expect(maskPhone(SECRET_NUMBER)).toBe("(•••) •••-0142");
    for (const odd of ["2065550142", "(206) 555-0142", "", null, undefined])
      expect(maskPhone(odd)).toBeNull();
  });

  const adding = { adding: true, hasDetails: false };
  it("needs a valid number and a valid email to add, and names each one that is wrong", () => {
    expect(
      checkRosterDetails(
        { phone: "(206) 555-0142", email: "D@Example.test", linkedin: "" },
        adding,
      ),
    ).toEqual({
      ok: true,
      details: { phone: SECRET_NUMBER, email: "d@example.test", linkedin: null },
    });
    expect(checkRosterDetails({ phone: "", email: "", linkedin: "" }, adding)).toEqual({
      ok: false,
      problems: ["phone", "email"],
    });
    expect(checkRosterDetails({ phone: "(206) 555-0142", email: "" }, adding)).toEqual({
      ok: false,
      problems: ["email"],
    });
    expect(checkRosterDetails({ phone: "", email: "d@example.test" }, adding)).toEqual({
      ok: false,
      problems: ["phone"],
    });
    expect(checkRosterDetails(null, adding)).toEqual({ ok: false, problems: ["phone", "email"] });
    for (const phone of [
      "12345",
      "+44 20 7946 0958",
      "(206) 155-0142",
      "206-555-0142 ext 4",
      "call me",
    ])
      expect(checkRosterDetails({ phone, email: "d@example.test" }, adding)).toEqual({
        ok: false,
        problems: ["phone"],
      });
    expect(
      checkRosterDetails(
        { phone: "(206) 555-0142", email: "d@example.test", linkedin: "example.test/me" },
        adding,
      ),
    ).toEqual({ ok: false, problems: ["linkedin"] });
  });

  it("keeps the stored number when the box is left empty, only for a person who has one", () => {
    const has = { adding: false, hasDetails: true };
    expect(checkRosterDetails({ phone: "", email: "d@example.test", linkedin: "" }, has)).toEqual({
      ok: true,
      details: { phone: null, email: "d@example.test", linkedin: null },
    });
    expect(checkRosterDetails({ phone: " ", email: "" }, has)).toEqual({
      ok: false,
      problems: ["email"],
    });
  });

  it("lets a person from before stay as they are, but takes a first set of details only whole", () => {
    const legacy = { adding: false, hasDetails: false };
    expect(checkRosterDetails({ phone: "", email: " ", linkedin: "" }, legacy)).toEqual({
      ok: true,
      details: null,
    });
    expect(checkRosterDetails({ phone: "", email: "d@example.test" }, legacy)).toEqual({
      ok: false,
      problems: ["phone"],
    });
    expect(checkRosterDetails({ linkedin: "linkedin.com/in/dana" }, legacy)).toEqual({
      ok: false,
      problems: ["phone", "email"],
    });
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
          phoneMasked: "(•••) •••-0142",
          email: "tomas@example.test",
          needsDetails: false,
        },
      });
      expect(rows).toEqual([expect.objectContaining({ org_id: ORG })]);
      expect(JSON.stringify(result)).not.toMatch(/2065550142/);
    }
  });

  it("refuses an add without a valid number and a valid email, names what is wrong, and writes nothing", async () => {
    const cases: [Partial<RosterSaveInput>, string[]][] = [
      [{ phone: "", email: "" }, ["phone", "email"]],
      [{ phone: "" }, ["phone"]],
      [{ email: "" }, ["email"]],
      [{ phone: "12345" }, ["phone"]],
      [{ phone: "+44 20 7946 0958" }, ["phone"]],
      [{ email: "tomas@" }, ["email"]],
      [{ linkedin: "https://evil.example/in/tomas" }, ["linkedin"]],
      [{ name: " ", email: "nope" }, ["name", "email"]],
    ];
    for (const [over, problems] of cases) {
      const { deps, writes, rows } = world({ rows: [] });
      expect(await saveRosterContact(deps, input(over))).toEqual({
        ok: false,
        reason: "invalid",
        problems,
      });
      expect(writes).toEqual([]);
      expect(rows).toEqual([]);
    }
  });

  it("refuses an add even when the caller skips the page's check: the database's own answer is honoured", async () => {
    const { deps, rows } = world({ rows: [], saveAll: async () => "details" });
    expect(await saveRosterContact(deps, input())).toEqual({
      ok: false,
      reason: "invalid",
      problems: ["details"],
    });
    expect(rows).toEqual([]);
  });

  it("adds nobody before the database has a place for details, and still lets an older person be corrected", async () => {
    const { deps, rows, writes } = world({
      saveAll: async () => "absent",
      details: async () => "absent",
    });
    expect(await saveRosterContact(deps, input())).toEqual({ ok: false, reason: "unavailable" });
    expect(rows).toHaveLength(1);
    expect(
      await saveRosterContact(deps, input({ id: DANA, phone: "", email: "", name: "Dana W" })),
    ).toMatchObject({ ok: true, contact: { name: "Dana W", needsDetails: false } });
    expect(await saveRosterContact(deps, input({ id: DANA }))).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(writes).toEqual(["update"]);
  });

  it("corrects details: an empty number box keeps the stored one, a typed one replaces it", async () => {
    const kept = world({ stored: [detail()] });
    expect(
      await saveRosterContact(
        kept.deps,
        input({ id: DANA, phone: "", email: "new@example.test", linkedin: "linkedin.com/in/dana" }),
      ),
    ).toMatchObject({
      ok: true,
      contact: {
        phoneMasked: "(•••) •••-0142",
        email: "new@example.test",
        linkedin: "https://www.linkedin.com/in/dana",
      },
    });
    expect(kept.stored[0]).toMatchObject({ phone_e164: SECRET_NUMBER, email: "new@example.test" });
    const changed = world({ stored: [detail()] });
    await saveRosterContact(changed.deps, input({ id: DANA, phone: "206.555.0199" }));
    expect(changed.stored[0]?.phone_e164).toBe("+12065550199");
    // Details cannot be emptied once they are there.
    expect(
      await saveRosterContact(
        world({ stored: [detail()] }).deps,
        input({ id: DANA, phone: "", email: "" }),
      ),
    ).toEqual({ ok: false, reason: "invalid", problems: ["email"] });
  });

  it("leaves a person from before as they are when corrected with no details, still marked as needing them", async () => {
    const { deps, stored } = world();
    expect(
      await saveRosterContact(deps, input({ id: DANA, phone: "", email: "", name: "Dana W" })),
    ).toMatchObject({ ok: true, contact: { name: "Dana W", needsDetails: true, email: null } });
    expect(stored).toEqual([]);
    expect(
      await saveRosterContact(deps, input({ id: DANA, phone: "", email: "d@example.test" })),
    ).toEqual({ ok: false, reason: "invalid", problems: ["phone"] });
    expect(await saveRosterContact(deps, input({ id: DANA }))).toMatchObject({
      ok: true,
      contact: { needsDetails: false, phoneMasked: "(•••) •••-0142" },
    });
  });

  it("lets the same number and email sit on several people", async () => {
    const { deps, stored } = world({ stored: [detail()] });
    expect(
      await saveRosterContact(deps, input({ phone: "(206) 555-0142", email: "dana@example.test" })),
    ).toMatchObject({ ok: true });
    expect(stored.map((d) => d.phone_e164)).toEqual([SECRET_NUMBER, SECRET_NUMBER]);
  });

  it("refuses every other role with a 403 before any read or write", async () => {
    for (const role of ["em", "manager", "analyst", "coach", "guest"]) {
      const { deps, writes } = world({ role });
      const count = vi.spyOn(deps, "details");
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

  it("stops at the limit, and does not add when the write cannot be made", async () => {
    const full = world({ saveAll: async () => "full" });
    expect(await saveRosterContact(full.deps, input())).toEqual({ ok: false, reason: "full" });
    const blind = world({ saveAll: async () => null });
    expect(await saveRosterContact(blind.deps, input())).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect([...full.writes, ...blind.writes]).toEqual([]);
  });

  it("says it did not save when the write fails or throws, never that it worked", async () => {
    expect(await saveRosterContact(world({ saveAll: async () => null }).deps, input())).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(
      await saveRosterContact(world({ details: async () => null }).deps, input({ id: DANA })),
    ).toEqual({ ok: false, reason: "unavailable" });
    const thrown = world({
      saveAll: async () => {
        throw new Error(`Failing row contains (${SECRET_NUMBER}, tomas@example.test)`);
      },
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const answer = await saveRosterContact(thrown.deps, input());
    expect(answer).toEqual({ ok: false, reason: "unavailable" });
    expect(JSON.stringify(answer) + JSON.stringify(spy.mock.calls)).not.toMatch(
      /2065550142|example\.test/,
    );
    spy.mockRestore();
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

describe("sendRosterInvite, with a stand-in sender that sends nothing", () => {
  const now = new Date("2026-11-20T12:00:00Z");
  const ask = { profile_id: null, id: DANA };
  const ORIGIN = "https://lasso.example";

  it("emails the person's own link to the address on file, for an admin and a lead, and notes the day", async () => {
    for (const role of ["admin", "lead"]) {
      const { deps, sent, stored } = world({ role, stored: [detail()] });
      expect(await sendRosterInvite(deps, ask, ORIGIN, now)).toMatchObject({
        ok: true,
        contact: { id: DANA, invitedOn: "2026-11-20", phoneMasked: "(•••) •••-0142" },
      });
      expect(sent).toEqual([
        {
          to: "dana@example.test",
          name: "Dana Whitlock",
          workspace: "Kestrel Bay Advisory",
          link: `${ORIGIN}/texts?w=${ORG}&c=${DANA}`,
        },
      ]);
      expect(stored[0]?.invite_sent_at).toBe(now.toISOString());
    }
  });

  it("hands the sender no number, and takes no address from the request", async () => {
    const { deps, sent } = world({ stored: [detail()] });
    await sendRosterInvite(
      deps,
      { ...ask, email: "attacker@example.test", to: "attacker@example.test" } as never,
      ORIGIN,
      now,
    );
    expect(JSON.stringify(sent)).not.toMatch(/attacker|2065550142|phone/);
  });

  it("refuses every other role with a 403 before any read or send", async () => {
    for (const role of ["em", "manager", "analyst", "coach", "guest"]) {
      const { deps, sent } = world({ role, stored: [detail()] });
      const one = vi.spyOn(deps, "one");
      await expect(sendRosterInvite(deps, ask, ORIGIN, now)).rejects.toMatchObject({ status: 403 });
      expect(one).not.toHaveBeenCalled();
      expect(sent).toEqual([]);
    }
  });

  it("sends nothing for another workspace's person, a person with no email, or a link emailed minutes ago", async () => {
    const theirs = row({ id: "0000000c-0000-4000-8000-0000000000bb", org_id: OTHER_ORG });
    const other = world({
      rows: [row(), theirs],
      stored: [detail({ roster_contact_id: theirs.id })],
    });
    expect(
      await sendRosterInvite(other.deps, { profile_id: null, id: theirs.id }, ORIGIN, now),
    ).toEqual({ ok: false, reason: "missing" });
    const none = world();
    expect(await sendRosterInvite(none.deps, ask, ORIGIN, now)).toEqual({
      ok: false,
      reason: "no_email",
    });
    const recent = world({
      stored: [
        detail({ invite_sent_at: new Date(now.getTime() - INVITE_GAP_MS + 1000).toISOString() }),
      ],
    });
    expect(await sendRosterInvite(recent.deps, ask, ORIGIN, now)).toEqual({
      ok: false,
      reason: "recent",
    });
    const later = world({
      stored: [detail({ invite_sent_at: new Date(now.getTime() - INVITE_GAP_MS).toISOString() })],
    });
    expect(await sendRosterInvite(later.deps, ask, ORIGIN, now)).toMatchObject({ ok: true });
    expect([...other.sent, ...none.sent, ...recent.sent]).toEqual([]);
  });

  it("says plainly when nothing was sent, and never notes a day for an email that did not go", async () => {
    for (const [answer, reason] of [
      ["not_set_up", "not_set_up"],
      ["failed", "unavailable"],
    ] as const) {
      const { deps, stored, writes } = world({
        stored: [detail()],
        sendInvite: async () => answer,
      });
      expect(await sendRosterInvite(deps, ask, ORIGIN, now)).toEqual({ ok: false, reason });
      expect(stored[0]?.invite_sent_at).toBeNull();
      expect(writes).toEqual([]);
    }
    const thrown = world({
      stored: [detail()],
      sendInvite: async () => Promise.reject(new Error("dana@example.test")),
    });
    expect(await sendRosterInvite(thrown.deps, ask, ORIGIN, now)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("20 Nov: the real sender goes through Resend from the invite address, says not_set_up with no key, and never logs", async () => {
    const mail = { to: "dana@example.test", name: "Dana", workspace: "W", link: "https://lasso.example/texts?w=1&c=2" };
    const { sendRosterInviteMail } = await import("@/lib/roster-invite-sender.server");
    const saved = process.env["RESEND_API_KEY"];
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const logSpy = vi.spyOn(console, "log");
    const errorSpy = vi.spyOn(console, "error");
    try {
      delete process.env["RESEND_API_KEY"];
      expect(await sendRosterInviteMail(mail)).toBe("not_set_up");
      expect(fetchSpy).not.toHaveBeenCalled();

      process.env["RESEND_API_KEY"] = "re_test";
      fetchSpy.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      expect(await sendRosterInviteMail(mail)).toBe("sent");
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(url).toBe("https://api.resend.com/emails");
      const body = JSON.parse(String((init as RequestInit).body));
      expect(body.to).toEqual(["dana@example.test"]);
      expect(body.subject).toBe(rosterInviteEmail(mail).subject);
      expect(body.text).toContain(mail.link);

      fetchSpy.mockResolvedValueOnce(new Response("nope", { status: 422 }));
      expect(await sendRosterInviteMail(mail)).toBe("failed");
      fetchSpy.mockRejectedValueOnce(new Error("offline"));
      expect(await sendRosterInviteMail(mail)).toBe("failed");
      for (const spy of [logSpy, errorSpy]) expect(JSON.stringify(spy.mock.calls)).not.toMatch(/dana|texts\?w=/);
    } finally {
      if (saved === undefined) delete process.env["RESEND_API_KEY"];
      else process.env["RESEND_API_KEY"] = saved;
      fetchSpy.mockRestore();
      logSpy.mockRestore();
      errorSpy.mockRestore();
    }
    // The rule stays in roster.server.ts; the service stays behind the one sender function.
    const server = readFileSync("src/lib/roster.server.ts", "utf8");
    expect(server).not.toMatch(/sendViaResend|resendApiKey|sendResendTemplate|api\.resend/);
    expect(readFileSync("src/lib/roster.functions.ts", "utf8")).toMatch(/rosterHandlers\.invite\(/);
  });

  it("writes a branded email: who asks, the link, that nothing is sent unless they agree, and typed text made safe", () => {
    const mail = rosterInviteEmail({
      name: "Dana <b>W</b>",
      workspace: "Kestrel & Bay\nBcc: x@example.test",
      link: "https://lasso.example/texts?w=a&c=b",
    });
    expect(mail.subject).not.toMatch(/[\r\n]/);
    expect(mail.text).toContain("https://lasso.example/texts?w=a&c=b");
    expect(mail.text).toMatch(/No text is sent unless you agree\./);
    expect(mail.html).toContain('href="https://lasso.example/texts?w=a&amp;c=b"');
    expect(mail.html).not.toMatch(/<b>/);
    expect(mail.subject + mail.text + mail.html.replace("<!DOCTYPE html>", "")).not.toMatch(/[—–!]/);
    // QA of PR 288 M1: the same lockup and rule as the workspace invite, and the service never named.
    expect(mail.html).toContain("lockup-clear.gif");
    expect(mail.html).toContain("nb-rule-frontdoor.png");
    expect(mail.html).toContain('alt="Lasso by Charlotte Labs"');
    expect(mail.subject + mail.text + mail.html).not.toMatch(/resend|bird/i);
    expect(mail.subject).toBe("Kestrel & Bay Bcc: x@example.test: agree to texts about proposals you help with");
    expect(mail.html).toContain("Kestrel &amp; Bay");
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
    expect(code(server) + code(shared) + code(fns) + code(panel)).not.toMatch(/select\("\*"\)/);
  });

  it("reads the typed number in one place, and it leaves that place only masked", () => {
    expect(DETAIL_COLUMNS).toBe(
      "roster_contact_id, phone_e164, email, linkedin_url, invite_sent_at",
    );
    // In the server file the stored number is named where it is typed, where it is selected, and where it is masked.
    const uses = code(server)
      .split("\n")
      .filter((line) => /phone_e164/.test(line))
      .map((line) => line.trim());
    expect(uses).toEqual([
      "phone_e164: string;",
      "phoneMasked: maskPhone(extra.detail?.phone_e164),",
      'export const DETAIL_COLUMNS = "roster_contact_id, phone_e164, email, linkedin_url, invite_sent_at";',
    ]);
    // The browser's types have no field that could carry a full number back.
    const contactType = shared.slice(
      shared.indexOf("export type RosterContact = {"),
      shared.indexOf("export type RosterList"),
    );
    expect(contactType).not.toMatch(/phone(?!Masked)|e164/i);
    expect(panel).not.toMatch(/e164|contact\??\.phone\b/);
  });

  it("keeps the details table to the roster's own server file: nothing that sends a text can read it", () => {
    const files = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory()
          ? entry.name === "__tests__"
            ? []
            : files(`${dir}/${entry.name}`)
          : /\.(ts|tsx)$/.test(entry.name)
            ? [`${dir}/${entry.name}`]
            : [],
      );
    const touching = files("src").filter((file) =>
      /roster_contact_details|save_roster_contact|roster_number_differs/.test(
        readFileSync(file, "utf8"),
      ),
    );
    expect(touching).toEqual(["src/lib/roster.server.ts"]);
    // And the roster's server file sends no text and hands no number to anything that does.
    expect(server).not.toMatch(/text-sender|sendText|won-text|lead-ask|demo-text/);
  });

  it("records no event, and logs an error code only", () => {
    for (const source of [server, shared, fns, panel])
      expect(source).not.toMatch(/recordEvent|logEvent|posthog|trackEvent/);
    const logs = [...server.matchAll(/console\.\w+\(([^)]*)\)/g)].map((m) => m[1]);
    expect(logs).toHaveLength(1);
    expect(logs[0]).not.toMatch(/message|details|row|fields|name|data|mail|email/i);
    expect(server.match(/logFailure\("[a-z ]+", error\)/g)).toHaveLength(
      server.match(/logFailure\(/g)!.length - 1,
    );
    expect(shared + fns + panel).not.toMatch(/console\./);
  });

  it("puts sign-in in front of all four functions and takes no workspace from the browser", () => {
    expect(fns.match(/\.middleware\(\[requireSupabaseAuth\]\)/g)).toHaveLength(4);
    expect(fns.match(/createServerFn\(/g)).toHaveLength(4);
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
    expect(calls).toHaveLength(4);
    for (const call of calls)
      expect(call.slice(0, call.indexOf(";"))).toMatch(/\.eq\("org_id", orgId\)|org_id: orgId/);
    const details = real.split('.from("roster_contact_details")').slice(1);
    expect(details).toHaveLength(2);
    for (const call of details)
      expect(call.slice(0, call.indexOf(";"))).toMatch(/\.eq\("org_id", orgId\)/);
    expect(real).toMatch(/rpc\("save_roster_contact", \{\s+p_org: orgId,/);
    expect(real).toMatch(/rpc\("roster_number_differs", \{ p_org: orgId \}\)/);
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

  it("holds no number or email column on the roster itself, and only adds", () => {
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

describe("the contact details migration", () => {
  const sql = readFileSync("supabase/migrations/20261120100000_roster_contact_details.sql", "utf8");
  const undo = readFileSync("supabase/undo/20261120100000_roster_contact_details_undo.sql", "utf8");
  const bare = sql.replace(/--.*$/gm, "");

  it("says in its header that it is one paste and safe to run twice, with no em dash", () => {
    expect(sql.slice(0, 900)).toMatch(/ONE PASTE/);
    expect(sql.slice(0, 900)).toMatch(/Safe to run twice/);
    expect(sql + undo).not.toMatch(/[—–]/);
  });

  it("can run twice: every statement is guarded or repeatable", () => {
    const statements = bare
      .replace(/\$\$[\s\S]*?\$\$/g, "$$body$$")
      .split(";")
      .map((part) => part.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    const repeatable =
      /^(create table if not exists|create index if not exists|create or replace function|drop trigger if exists|create trigger roster_contact_details_t_guard|alter table public\.roster_contact_details enable row level security|revoke all on|grant select, insert, update on|grant execute on function|comment on table)( |$)/;
    for (const statement of statements) expect(statement).toMatch(repeatable);
    expect(statements).toHaveLength(16);
  });

  it("only adds: no existing table is altered and nothing is removed but its own trigger", () => {
    expect(bare.match(/\bdrop\b/gi)).toHaveLength(1);
    expect(bare).not.toMatch(
      /\b(truncate|delete from|drop table|drop column|drop index|drop policy|alter column|rename)\b/i,
    );
    expect(bare.match(/alter table public\.(\w+)/g)).toEqual([
      "alter table public.roster_contact_details",
    ]);
  });

  it("shuts the table and all three functions to every browser role, with row security on and no policy", () => {
    expect(bare).toMatch(/alter table public\.roster_contact_details enable row level security/);
    expect(bare).toMatch(
      /revoke all on table public\.roster_contact_details from public, anon, authenticated/,
    );
    expect(bare).toMatch(
      /grant select, insert, update on table public\.roster_contact_details to service_role/,
    );
    expect(bare).not.toMatch(/create policy|\bto (anon|authenticated)\b/i);
    for (const fn of [
      "roster_contact_details_guard\\(\\)",
      "save_roster_contact\\(uuid, uuid, text, text, text, text, text, text, text, integer\\)",
      "roster_number_differs\\(uuid\\)",
    ])
      expect(bare).toMatch(
        new RegExp(`revoke all on function public\\.${fn} from public, anon, authenticated`),
      );
  });

  it("needs a number and an email on every row, checks their shape, and makes neither unique", () => {
    expect(bare).toMatch(/phone_e164 text not null check/);
    expect(bare).toMatch(/email text not null check/);
    expect(bare).not.toMatch(/unique/i);
    expect(bare).toMatch(/references public\.roster_contacts\(id\) on delete cascade/);
  });

  it("refuses an add without both details before it writes anything", () => {
    const body = bare.slice(bare.indexOf("create or replace function public.save_roster_contact"));
    expect(body.indexOf("return 'details'")).toBeLessThan(
      body.indexOf("insert into public.roster_contacts"),
    );
    expect(body).toMatch(/where id = p_id and org_id = p_org\s+for update/);
  });

  it("compares the two numbers inside the database and answers only with who differs", () => {
    const fn = bare.slice(bare.indexOf("create or replace function public.roster_number_differs"));
    expect(fn).toMatch(/returns setof uuid/);
    expect(fn).toMatch(/select d\.roster_contact_id/);
    expect(fn).toMatch(/m\.revoked_at is null/);
    expect(fn).toMatch(/where d\.org_id = p_org and m\.phone_e164 <> d\.phone_e164/);
  });

  it("has an undo that removes only what this file made, and can run twice", () => {
    const lines = undo
      .replace(/--.*$/gm, "")
      .split(";")
      .map((part) => part.trim().replace(/\s+/g, " "))
      .filter(Boolean);
    expect(lines).toHaveLength(4);
    for (const line of lines)
      expect(line).toMatch(
        /^drop (function|table) if exists public\.(roster_number_differs|save_roster_contact|roster_contact_details|roster_contact_details_guard)\b/,
      );
    expect(undo).toMatch(/THIS DELETES DATA/);
  });
});

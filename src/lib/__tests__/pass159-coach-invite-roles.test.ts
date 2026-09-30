import { afterEach, describe, expect, it, vi } from "vitest";

import { coachScopeLine, inviteEmailVariant, joinNames } from "../invites-shared";
import { sendInviteEmail } from "../invites.server";
import { canManageMembers, canSeeFirmView, isCoach, membersLabel } from "../role-access";

const BANNED =
  /(telemetry|analytics|data collection|scor(e|ed|ing)|monitor|track|oversight|surveillance|—)/i;

const base = { to: "p@x.test", inviterName: "Dana", orgName: "Northline", code: "a" };

async function sent(extra: Record<string, unknown>) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "re_1" }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("RESEND_API_KEY", "re_test");
  await sendInviteEmail({ ...base, ...extra });
  return JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("invite variants", () => {
  it("chooses by role and org type", () => {
    expect(inviteEmailVariant("coach", "personal")).toBe("coach_personal");
    expect(inviteEmailVariant("coach", "business")).toBe("coach_business");
    expect(inviteEmailVariant("em", "business")).toBe("standard");
    expect(inviteEmailVariant(null, null)).toBe("standard");
  });

  it("joins names for 0, 1, 2 and 3", () => {
    expect(joinNames([])).toBe("");
    expect(joinNames(["Ada"])).toBe("Ada");
    expect(joinNames(["Ada", "Bo"])).toBe("Ada and Bo");
    expect(joinNames(["Ada", "Bo", "Cy"])).toBe("Ada, Bo and Cy");
  });

  it("sends the member template with inviter, org and a server-built link", async () => {
    const body = await sent({ role: "em", orgType: "business" });
    expect(body.template.id).toBe("invite-member");
    expect(body.template.variables).toEqual({
      INVITER_NAME: "Dana",
      ORG_NAME: "Northline",
      ACCEPT_URL: "https://lasso.charlotte-labs.com/join?code=a",
    });
    expect("subject" in body).toBe(false);
    expect("from" in body).toBe(false);
  });

  it("sends the personal coach template without an org name", async () => {
    const body = await sent({ role: "coach", orgType: "personal" });
    expect(body.template.id).toBe("invite-coach-personal");
    expect(Object.keys(body.template.variables).sort()).toEqual(["ACCEPT_URL", "INVITER_NAME"]);
  });

  it("sends the business coach template with a whole scope sentence", async () => {
    const body = await sent({ role: "coach", orgType: "business", subjectNames: ["Ada", "Bo"] });
    expect(body.template.id).toBe("invite-coach-firm");
    expect(body.template.variables.COACH_SCOPE_LINE).toBe(
      "You will see the work of the people you were added to: Ada and Bo. Nothing else in the workspace is visible to you.",
    );
    expect(BANNED.test(body.template.variables.COACH_SCOPE_LINE)).toBe(false);
  });

  it("omits the scope line with no subject names so the template falls back", async () => {
    const body = await sent({ role: "coach", orgType: "business" });
    expect("COACH_SCOPE_LINE" in body.template.variables).toBe(false);
    expect(coachScopeLine([])).toBeNull();
  });
});

describe("role access helpers", () => {
  const coach = { role: "coach", org_type: "company" };
  const admin = { role: "admin", org_type: "company" };
  const soloAdmin = { role: "admin", org_type: "personal" };
  const em = { role: "em", org_type: "company" };

  it("matches the rules the two nav components used", () => {
    expect(isCoach(coach)).toBe(true);
    expect(isCoach(em)).toBe(false);
    expect(canManageMembers(admin)).toBe(true);
    expect(canManageMembers({ role: "lead", org_type: "company" })).toBe(true);
    expect(canManageMembers(em)).toBe(false);
    expect(canSeeFirmView(admin)).toBe(true);
    expect(canSeeFirmView(soloAdmin)).toBe(false);
    expect(canSeeFirmView(em)).toBe(false);
    expect(membersLabel(admin)).toBe("Members");
    expect(membersLabel(soloAdmin)).toBe("Your coaches");
    expect(isCoach(null)).toBe(false);
    expect(canSeeFirmView(undefined)).toBe(false);
  });
});

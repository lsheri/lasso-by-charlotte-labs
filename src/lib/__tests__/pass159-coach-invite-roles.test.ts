import { describe, expect, it } from "vitest";

import { inviteEmailVariant, joinNames, renderInviteEmail } from "../invite-email";
import { canManageMembers, canSeeFirmView, isCoach, membersLabel } from "../role-access";

const BANNED =
  /(telemetry|analytics|data collection|scor(e|ed|ing)|monitor|track|oversight|surveillance|—)/i;

const base = { inviterName: "Dana", orgName: "Northline", acceptUrl: "https://x.test/join?code=a" };

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

  it("keeps the non-coach email byte identical to the version without new fields", () => {
    const before = renderInviteEmail(base);
    const after = renderInviteEmail({ ...base, role: "em", orgType: "business" });
    expect(after).toEqual(before);
    expect(before.subject).toBe("You are invited to Northline");
    expect(before.text).toContain("Accept your invite");
  });

  it("never renders the generic body for a coach", () => {
    const personal = renderInviteEmail({ ...base, role: "coach", orgType: "personal" });
    const business = renderInviteEmail({
      ...base,
      role: "coach",
      orgType: "business",
      subjectNames: ["Ada", "Bo"],
    });
    for (const mail of [personal, business]) {
      expect(mail.text).not.toContain("invited you to join Northline on Lasso");
      expect(mail.html).not.toContain("Accept your invite<");
      expect(BANNED.test(mail.text)).toBe(false);
    }
    expect(personal.subject).toBe("Dana asked you to coach their work");
    expect(personal.text).toContain("Accept and take a look");
    expect(business.subject).toBe("You are invited to coach at Northline");
    expect(business.text).toContain("Ada and Bo");
    expect(business.text).toContain("Accept and start coaching");
  });

  it("never puts subject names in the subject line", () => {
    const mail = renderInviteEmail({
      ...base,
      role: "coach",
      orgType: "business",
      subjectNames: ["Ada", "Bo"],
    });
    expect(mail.subject).not.toContain("Ada");
    expect(mail.subject).not.toContain("Bo");
  });

  it("falls back to the generic sentence with no subject names", () => {
    const mail = renderInviteEmail({ ...base, role: "coach", orgType: "business" });
    expect(mail.text).toContain("the people you were added to, and nothing else in the workspace");
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

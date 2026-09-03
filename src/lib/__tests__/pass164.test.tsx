import { describe, expect, it } from "vitest";

import {
  DAYS_SINCE_SIGNUP_BANDS,
  WALKTHROUGH_SECTIONS,
  daysSinceSignupBand,
  walkthroughFor,
  walkthroughVariant,
  type WalkthroughVariant,
} from "@/lib/walkthrough";

const BANNED = /monitor|track|scor|oversight|surveillance|—|!/i;

function profile(role: string, org_type: string) {
  return { role, org_type };
}

describe("pass 164 walkthrough variant", () => {
  it("reads personal, company member, admin and coach profiles", () => {
    expect(walkthroughVariant(profile("em", "personal"))).toBe("personal");
    expect(walkthroughVariant(profile("em", "company"))).toBe("company_member");
    expect(walkthroughVariant(profile("admin", "company"))).toBe("company_member");
    expect(walkthroughVariant(profile("admin", "personal"))).toBe("personal");
    expect(walkthroughVariant(profile("coach", "company"))).toBe("coach");
    expect(walkthroughVariant(profile("coach", "personal"))).toBe("coach");
    expect(walkthroughVariant(null)).toBe("personal");
  });

  it("never gives a coach the capture first path", () => {
    const coach = walkthroughFor("coach");
    expect(coach.sections[0]?.id).toBe("what_you_can_see");
    expect(coach.sections.map((s) => s.id)).not.toContain("say_the_sentence");
    expect(coach.sections.map((s) => s.id)).not.toContain("connect_ai");
    expect(coach.next.to).toBe("/coaching");
  });

  it("leads the other variants with the sentence", () => {
    for (const variant of ["personal", "company_member"] as WalkthroughVariant[]) {
      const guide = walkthroughFor(variant);
      expect(guide.sections[0]?.id).toBe("say_the_sentence");
      expect(guide.sections[0]?.body.join(" ")).toContain("Push this conversation to Lasso.");
    }
  });

  it("keeps every section id inside the closed vocabulary and ends with a real link", () => {
    for (const variant of ["personal", "company_member", "coach"] as WalkthroughVariant[]) {
      const guide = walkthroughFor(variant);
      for (const section of guide.sections) {
        expect(WALKTHROUGH_SECTIONS).toContain(section.id);
      }
      expect(new Set(guide.sections.map((s) => s.id)).size).toBe(guide.sections.length);
      expect(guide.next.to.startsWith("/")).toBe(true);
    }
  });

  it("holds the language laws on every line", () => {
    for (const variant of ["personal", "company_member", "coach"] as WalkthroughVariant[]) {
      const guide = walkthroughFor(variant);
      const text = [
        guide.title,
        guide.intro,
        guide.next.label,
        guide.next.note,
        ...guide.sections.flatMap((s) => [s.title, ...s.body]),
      ].join(" ");
      expect(BANNED.test(text)).toBe(false);
    }
  });

  it("bands the age of an account", () => {
    const now = Date.UTC(2026, 0, 31);
    expect(daysSinceSignupBand(now, now)).toBe("0");
    expect(daysSinceSignupBand(now - 86400000, now)).toBe("1-7");
    expect(daysSinceSignupBand(now - 7 * 86400000, now)).toBe("1-7");
    expect(daysSinceSignupBand(now - 8 * 86400000, now)).toBe("8-30");
    expect(daysSinceSignupBand(now - 30 * 86400000, now)).toBe("8-30");
    expect(daysSinceSignupBand(now - 31 * 86400000, now)).toBe("30+");
    expect(daysSinceSignupBand(null, now)).toBe("0");
    for (const band of DAYS_SINCE_SIGNUP_BANDS) expect(typeof band).toBe("string");
  });
});

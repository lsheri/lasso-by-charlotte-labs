// The QA password reset touches only the six QA identities, never a real account.
import { describe, expect, it } from "vitest";

import { QA_EMAILS, newQaPassword, qaUsersToReset } from "@/lib/qa-seed.functions";

describe("QA password reset", () => {
  it("lists only .test QA identities", () => {
    expect(QA_EMAILS).toHaveLength(6);
    for (const email of QA_EMAILS) expect(email).toMatch(/^qa\.[a-z.]+@qaprobe\.test$/);
  });

  it("matches exact QA emails only", () => {
    const ids = qaUsersToReset([
      { id: "1", email: "qa.company.admin@qaprobe.test" },
      { id: "2", email: "QA.Personal@qaprobe.test" },
      { id: "3", email: "liam@charlotte-labs.com" },
      { id: "4", email: "qa.company.admin@qaprobe.test.evil.com" },
      { id: "5", email: "someone@qaprobe.test" },
      { id: "6", email: null },
    ]);
    expect([...ids.entries()]).toEqual([
      ["qa.company.admin@qaprobe.test", "1"],
      ["qa.personal@qaprobe.test", "2"],
    ]);
  });

  it("refuses a non-.test email even if it is passed in the list", () => {
    expect(
      qaUsersToReset([{ id: "3", email: "liam@charlotte-labs.com" }], ["liam@charlotte-labs.com"])
        .size,
    ).toBe(0);
  });

  it("makes a fresh 24-character URL-safe password each time", () => {
    const a = newQaPassword();
    const b = newQaPassword();
    expect(a).toMatch(/^[A-Za-z0-9_-]{24}$/);
    expect(a).not.toBe(b);
  });
});

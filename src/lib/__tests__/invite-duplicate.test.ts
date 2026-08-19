import { describe, expect, it } from "vitest";

import { coachToShareWithInstead, findMemberByEmail, type MemberRow } from "../members-shared";

const member = (over: Partial<MemberRow>): MemberRow => ({
  id: "m1",
  display_name: "Ada Vale",
  email: "ada@firm.com",
  role: "coach",
  created_at: "2026-01-01T00:00:00.000Z",
  deactivated_at: null,
  ...over,
});

describe("duplicate invite check", () => {
  const members = [
    member({}),
    member({ id: "m2", display_name: "Ben Ro", email: "ben@firm.com", role: "em" }),
  ];

  it("matches case and whitespace insensitively", () => {
    expect(findMemberByEmail(members, "  ADA@firm.com ")?.id).toBe("m1");
  });

  it("answers nothing for an address it cannot already see", () => {
    expect(findMemberByEmail(members, "stranger@elsewhere.com")).toBeNull();
    expect(findMemberByEmail([], "ada@firm.com")).toBeNull();
    expect(findMemberByEmail(members, "   ")).toBeNull();
  });

  it("offers a share only for an active coach", () => {
    expect(coachToShareWithInstead(members, "ada@firm.com")?.id).toBe("m1");
    expect(coachToShareWithInstead(members, "ben@firm.com")).toBeNull();
    expect(
      coachToShareWithInstead(
        [member({ deactivated_at: "2026-02-01T00:00:00.000Z" })],
        "ada@firm.com",
      ),
    ).toBeNull();
  });
});

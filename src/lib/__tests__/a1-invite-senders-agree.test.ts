import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { inviteEmailVariant } from "@/lib/invites-shared";
import { isFirmWorkspace } from "@/lib/org-type";

const SRC = join(process.cwd(), "src");

describe("A1 invite senders agree on business workspaces", () => {
  it("the resend path in invites.functions.ts classifies through isFirmWorkspace", () => {
    const fn = readFileSync(join(SRC, "lib/invites.functions.ts"), "utf8");
    expect(fn).toContain('import { isFirmWorkspace } from "@/lib/org-type";');
    expect(fn).toContain("const orgType = isFirmWorkspace(");
    expect(fn).not.toContain('["type"] === "company"');
  });

  it("a partner workspace gets the firm coach letter, matching members.server.ts", () => {
    const orgType = isFirmWorkspace("partner") ? ("business" as const) : ("personal" as const);
    expect(inviteEmailVariant("coach", orgType)).toBe("coach_business");
  });
});

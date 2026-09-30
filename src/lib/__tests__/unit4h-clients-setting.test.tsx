import { describe, expect, it } from "vitest";

import { canSetWorkspaceShape } from "@/lib/role-access";
import { clientsEnabled } from "@/lib/workspace-settings";

describe("unit 4h clientsEnabled", () => {
  it("is true only for an explicit true", () => {
    expect(clientsEnabled({ clients_enabled: true })).toBe(true);
    expect(clientsEnabled({ clients_enabled: false })).toBe(false);
    expect(clientsEnabled({ clients_enabled: undefined } as unknown as { clients_enabled?: boolean })).toBe(false);
    expect(clientsEnabled(null)).toBe(false);
    expect(clientsEnabled(undefined)).toBe(false);
    expect(clientsEnabled({})).toBe(false);
  });
});

describe("unit 4h canSetWorkspaceShape", () => {
  it("is admin only", () => {
    expect(canSetWorkspaceShape({ role: "admin", org_type: "company" })).toBe(true);
    for (const role of ["lead", "em", "coach"]) {
      expect(canSetWorkspaceShape({ role, org_type: "company" })).toBe(false);
    }
  });
});

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("sonner", () => ({ toast: { error: () => undefined } }));

import { pickActive, switcherProfiles, type Profile } from "@/hooks/use-profile";

function profile(over: Partial<Profile>): Profile {
  return {
    id: "p1",
    user_id: "u1",
    org_id: "o1",
    role: "em",
    display_name: "Dana",
    title_band: null,
    org_name: "Northline",
    org_type: "company",
    clients_enabled: true,
    onboarding: null,
    ...over,
  } as Profile;
}

function guest(id: string): Profile {
  return profile({ id, org_id: `o-${id}`, org_name: "Bright Path", is_guest: true });
}

describe("OWN-1: a guest seat is not a workspace", () => {
  it("board-invite no longer switches profiles on accept or open", () => {
    const source = readFileSync(join(process.cwd(), "src/routes/board-invite.tsx"), "utf8");
    expect(source).not.toContain("setActiveProfileId");
  });

  it("never seeds a guest profile into user_active_profile", () => {
    const source = readFileSync(join(process.cwd(), "src/hooks/use-profile.ts"), "utf8");
    expect(source).toContain("active.is_guest");
  });

  it("returns a non-guest profile when the database row names a guest seat", () => {
    const own = profile({});
    expect(pickActive([own, guest("g1")], null, "g1")?.id).toBe(own.id);
  });

  it("returns a non-guest profile when the stored choice names a guest seat", () => {
    const own = profile({});
    expect(pickActive([own, guest("g1")], "g1", null)?.id).toBe(own.id);
  });

  it("falls back to the first non-guest profile, and null when only guests exist", () => {
    const second = profile({ id: "b", org_id: "o2" });
    const first = profile({ id: "a", org_id: "o3" });
    expect(pickActive([second, guest("g1"), first], null, null)?.id).toBe(second.id);
    expect(pickActive([guest("g1")], null, null)).toBeNull();
    expect(pickActive([], null, null)).toBeNull();
  });

  it("keeps guest seats out of the switcher list", () => {
    const own = profile({});
    const seat = guest("g1");
    const list = switcherProfiles([own, seat]);
    expect(list.map((p) => p.id)).toEqual([own.id]);
    expect(list.some((p) => p.is_guest)).toBe(false);
  });
});

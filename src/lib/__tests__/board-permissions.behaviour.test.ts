import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("sonner", () => ({ toast: { error: () => undefined } }));

import { pickActive, type Profile } from "@/hooks/use-profile";
import { isSharedSpace } from "@/lib/shared-space";
import { ownsWorkItem } from "@/lib/work-ownership";

const me = { id: "p-me", role: "em" };

describe("ownsWorkItem", () => {
  it("is true when the owner is the profile", () => {
    expect(ownsWorkItem(me, { owner_id: "p-me" })).toBe(true);
  });
  it("is false for a different owner", () => {
    expect(ownsWorkItem(me, { owner_id: "p-other" })).toBe(false);
  });
  it("is false when the item has no owner", () => {
    expect(ownsWorkItem(me, { owner_id: null })).toBe(false);
    expect(ownsWorkItem(me, { owner_id: undefined })).toBe(false);
    expect(ownsWorkItem(me, {})).toBe(false);
  });
  it("is false with no profile", () => {
    expect(ownsWorkItem(null, { owner_id: "p-me" })).toBe(false);
    expect(ownsWorkItem(undefined, { owner_id: "p-me" })).toBe(false);
  });
  it("is false for a coach even with a matching owner id", () => {
    expect(ownsWorkItem({ id: "p-me", role: "coach" }, { owner_id: "p-me" })).toBe(false);
  });
});

describe("isSharedSpace", () => {
  it("is true across different workspaces", () => {
    expect(isSharedSpace("org-a", "org-b")).toBe(true);
  });
  it("is false inside the same workspace", () => {
    expect(isSharedSpace("org-a", "org-a")).toBe(false);
  });
  it("is false when either side is missing", () => {
    expect(isSharedSpace(null, "org-a")).toBe(false);
    expect(isSharedSpace(undefined, "org-a")).toBe(false);
    expect(isSharedSpace("org-a", null)).toBe(false);
    expect(isSharedSpace("org-a", undefined)).toBe(false);
    expect(isSharedSpace(null, null)).toBe(false);
  });
});

describe("pickActive", () => {
  it("returns the non-guest profile the row names even when it is not first", () => {
    const base = { user_id: "u1", role: "em", display_name: "Dana", title_band: null, org_type: "company", clients_enabled: true, onboarding: null };
    const first = { ...base, id: "a", org_id: "o1", org_name: "One" } as unknown as Profile;
    const seat = { ...base, id: "g", org_id: "og", org_name: "Guest", is_guest: true } as unknown as Profile;
    const named = { ...base, id: "c", org_id: "o3", org_name: "Three" } as unknown as Profile;
    expect(pickActive([first, seat, named], null, "c")?.id).toBe("c");
  });
});

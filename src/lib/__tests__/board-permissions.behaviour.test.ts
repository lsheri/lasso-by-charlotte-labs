import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
vi.mock("sonner", () => ({ toast: { error: () => undefined } }));

import { pickActive, type Profile } from "@/hooks/use-profile";
import { isSharedSpace } from "@/lib/shared-space";
import { ownsWorkItem } from "@/lib/work-ownership";
import { cardRemovable } from "@/lib/card-removable";
import type { WorkItemRow } from "@/lib/work-types";

const me = { id: "p-me", role: "em" };

describe("cardRemovable", () => {
  // Decorations carry no work behind them and stay removable for anyone.
  it("is true for a sticky with no workItemId", () => {
    expect(cardRemovable(me, { workItemId: null, authorProfileId: "p-other" }, undefined)).toBe(true);
  });
  it("is true for a text block with no workItemId", () => {
    expect(cardRemovable(me, { workItemId: null, authorProfileId: null }, undefined)).toBe(true);
  });
  it("is true for a shape (grouping) with no workItemId", () => {
    expect(cardRemovable(me, { workItemId: null, authorProfileId: "p-other" }, undefined)).toBe(true);
  });
  it("is true for a work node whose item the signed-in person owns", () => {
    expect(cardRemovable(me, { workItemId: "w1", authorProfileId: "p-me" }, { owner_id: "p-me" } as WorkItemRow)).toBe(true);
  });
  it("is false for a work node whose item belongs to someone else", () => {
    expect(cardRemovable(me, { workItemId: "w1", authorProfileId: "p-other" }, { owner_id: "p-other" } as WorkItemRow)).toBe(false);
  });
  it("falls back to the node author when the item has not loaded, true for own work", () => {
    expect(cardRemovable(me, { workItemId: "w1", authorProfileId: "p-me" }, undefined)).toBe(true);
  });
  it("falls back to the node author when the item has not loaded, false for a teammate's work", () => {
    expect(cardRemovable(me, { workItemId: "w1", authorProfileId: "p-other" }, undefined)).toBe(false);
  });
  it("is false when the item has not loaded and the node has no author", () => {
    expect(cardRemovable(me, { workItemId: "w1", authorProfileId: null }, undefined)).toBe(false);
    expect(cardRemovable(me, { workItemId: "w1" }, undefined)).toBe(false);
  });
  // A coach reads but never removes, even when the work is theirs.
  it("is false for a coach even when they own the work", () => {
    expect(cardRemovable({ id: "p-me", role: "coach" }, { workItemId: "w1", authorProfileId: "p-me" }, { owner_id: "p-me" } as WorkItemRow)).toBe(false);
  });
});

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

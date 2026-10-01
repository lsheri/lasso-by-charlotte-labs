import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

import { showWorkspaceCard } from "@/components/settings/YourWorkspaceCard";
import { callSetDataConsentRpc } from "../data-consent.functions";
import { isFirmWorkspace } from "../org-type";

describe("W-S1 workspace settings", () => {
  it.each(["company", "edu", "partner"] as const)("shows members in %s workspaces", (org_type) => {
    for (const role of ["em", "lead", "coach"]) {
      expect(showWorkspaceCard({ role, org_type })).toBe(true);
    }
  });

  it("hides admins and personal workspaces", () => {
    expect(showWorkspaceCard({ role: "admin", org_type: "company" })).toBe(false);
    expect(showWorkspaceCard({ role: "em", org_type: "personal" })).toBe(false);
  });

  it("treats company and partner as firms only", () => {
    expect(isFirmWorkspace("company")).toBe(true);
    expect(isFirmWorkspace("partner")).toBe(true);
    expect(isFirmWorkspace("personal")).toBe(false);
    expect(isFirmWorkspace("edu")).toBe(false);
  });

  it("sends the active profile id", async () => {
    const rpc = vi.fn(async () => ({ data: 4, error: null }));
    await callSetDataConsentRpc(rpc, {
      p_scope: "org",
      p_tier: "c",
      p_tier_d_switch: false,
      p_consent_text_version: "dc-v4",
      p_notice_hash: "hash",
      p_surface: "org_settings",
      p_profile_id: "active-profile",
    });
    expect(rpc).toHaveBeenCalledOnce();
    expect(rpc.mock.calls[0]?.[1]).toMatchObject({ p_profile_id: "active-profile" });
  });

  it.each([
    { code: "PGRST202", message: "missing" },
    { message: "Could not find the function public.set_data_consent" },
  ])("falls back once for a missing function signature", async (missing) => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: missing })
      .mockResolvedValueOnce({ data: 5, error: null });
    await callSetDataConsentRpc(rpc, {
      p_scope: "user",
      p_tier: "b",
      p_tier_d_switch: false,
      p_consent_text_version: "dc-v4",
      p_notice_hash: "hash",
      p_surface: "personal_settings",
      p_profile_id: "active-profile",
    });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[1]?.[1]).not.toHaveProperty("p_profile_id");
  });

  it("does not retry other errors", async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { code: "42501", message: "denied" } }));
    await callSetDataConsentRpc(rpc, {
      p_scope: "org",
      p_tier: "a",
      p_tier_d_switch: false,
      p_consent_text_version: "dc-v4",
      p_notice_hash: "hash",
      p_surface: "org_settings",
      p_profile_id: "active-profile",
    });
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("mounts the card first on both workspace settings surfaces", () => {
    for (const path of ["src/components/settings/SettingsDialog.tsx", "src/pages/SettingsPage.tsx"]) {
      const source = readFileSync(path, "utf8");
      expect(source.indexOf("<YourWorkspaceCard />")).toBeLessThan(source.indexOf("<OrgDimensionsCard />"));
    }
  });
});
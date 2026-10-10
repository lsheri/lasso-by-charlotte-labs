// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", org_id: "org-1", role: "admin", org_type: "company" } as Record<string, unknown>,
  row: { name: "Acme", industry: "Technology", size_band: "11-50", country: "US", use_for: "work" },
  updates: [] as Array<Record<string, unknown>>,
  logV2: vi.fn(),
}));

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: mocks.profile }) }));
vi.mock("@/lib/telemetry-v2", () => ({ logV2: mocks.logV2 }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: mocks.row, error: null }) }) }),
      update: (p: Record<string, unknown>) => {
        mocks.updates.push(p);
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
}));

import { COUNTRIES, segmentFieldsFor } from "@/lib/org-segments";
import { OrgDimensionsCard } from "@/components/settings/OrgDimensionsCard";

vi.setConfig({ testTimeout: 20000 });

afterEach(() => {
  cleanup();
  mocks.updates.length = 0;
  mocks.logV2.mockClear();
});

async function renderCard(org_type: string) {
  mocks.profile = { ...mocks.profile, org_type };
  render(
    <QueryClientProvider client={new QueryClient()}>
      <OrgDimensionsCard />
    </QueryClientProvider>,
  );
  await screen.findByText("About this workspace");
}

describe("DEM-1 demographics", () => {
  it("COUNTRIES maps US to United States and every value is two uppercase letters", () => {
    expect(COUNTRIES.find((c) => c.value === "US")?.label).toBe("United States");
    expect(COUNTRIES.every((c) => /^[A-Z]{2}$/.test(c.value))).toBe(true);
    expect(COUNTRIES.length).toBe(249);
  });

  it("one helper decides the shape", () => {
    expect(segmentFieldsFor("company")).toEqual(["industry", "size_band", "country"]);
    expect(segmentFieldsFor("partner")).toEqual(["industry", "size_band", "country"]);
    expect(segmentFieldsFor("personal")).toEqual(["use_for", "country"]);
    expect(segmentFieldsFor("edu")).toEqual(["use_for", "country"]);
  });

  it("settings company: Industry and People, no question; saves exactly its fields", async () => {
    await renderCard("company");
    expect(screen.getByText("Industry")).toBeTruthy();
    expect(screen.getByText("People")).toBeTruthy();
    expect(screen.queryByText("What is this for")).toBeNull();
    expect(screen.getByText("United States")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0]).toEqual({ name: "Acme", industry: "Technology", size_band: "11-50", country: "US" });
    await waitFor(() => expect(mocks.logV2).toHaveBeenCalled());
    expect(mocks.logV2.mock.calls[0]?.[1]).toEqual({ fields_set: 3 });
  });

  it.each(["personal", "edu"])("settings %s: question, no Industry or People; saves exactly its fields", async (t) => {
    await renderCard(t);
    expect(screen.getByText("What is this for")).toBeTruthy();
    expect(screen.queryByText("Industry")).toBeNull();
    expect(screen.queryByText("People")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.updates).toHaveLength(1));
    expect(mocks.updates[0]).toEqual({ name: "Acme", use_for: "work", country: "US" });
    await waitFor(() => expect(mocks.logV2).toHaveBeenCalled());
    expect(mocks.logV2.mock.calls[0]?.[1]).toEqual({ fields_set: 2 });
  });

  it("onboarding asks Country in both shapes and writes only what it asked", () => {
    const src = readFileSync("src/routes/onboarding.tsx", "utf8");
    const seg = src.slice(src.indexOf('if (stage === "segment")'), src.indexOf('if (stage === "tools")'));
    expect(seg).toContain('htmlFor="seg-country"');
    // Country sits after the shape branch, so both shapes render it.
    expect(seg.indexOf('htmlFor="seg-country"')).toBeGreaterThan(seg.indexOf('htmlFor="seg-people"'));
    expect(src).toContain("? { use_for: useFor, country }");
    expect(src).toContain(": { industry, size_band: sizeBand, country };");
    expect(src).toContain("? [useFor, country] : [industry, sizeBand, country]");
  });
});

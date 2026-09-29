// @vitest-environment jsdom
import { readFileSync } from "node:fs";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DEMO_BANNED_PATTERN, neutralDemoCopy, neutralDemoText } from "@/lib/demo-neutral-copy";
import { parseLandingProof } from "@/lib/landing-proof-shared";

const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...args: unknown[]) => logEvent(...args) }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1" } }),
}));

afterEach(() => {
  cleanup();
  logEvent.mockClear();
});

describe("onboarding with no door signal goes to /plans", () => {
  it("redirects with from and src carried through", async () => {
    vi.doMock("@/integrations/supabase/client", () => ({ supabase: {} }));
    const { plansRedirectSearch } = await import("@/routes/onboarding");
    expect(plansRedirectSearch({ from: "edu", src: "email" } as never, false)).toEqual({
      from: "edu",
      src: "email",
    });
    expect(plansRedirectSearch({}, false)).toEqual({});
    expect(plansRedirectSearch({ intent: "invite" }, false)).toEqual({});
    expect(plansRedirectSearch({ intent: "company" }, false)).toBeNull();
    expect(plansRedirectSearch({ intent: "personal" }, false)).toBeNull();
    expect(plansRedirectSearch({}, true)).toBeNull();
    expect(plansRedirectSearch({ setup: true }, false)).toBeNull();
  }, 30_000);

  it("the three-card chooser and the tenancy sentence are gone", () => {
    const source = readFileSync("src/routes/onboarding.tsx", "utf8");
    expect(source).not.toMatch(/Who is this for\?/);
    expect(source).not.toMatch(/tenancy/i);
    expect(source).toContain('redirect({ to: "/plans"');
  });
});

describe("connector.setup_opened fires from a non-AI card", () => {
  it("ExportGuideCard records it with surface and had_connector", async () => {
    const { ExportGuideCard } = await import("@/components/onboarding/ExportGuideCard");
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <ExportGuideCard tool="gemini" />
      </QueryClientProvider>,
    );
    await waitFor(() =>
      expect(logEvent).toHaveBeenCalledWith("connector.setup_opened", "o1", {
        surface: "onboarding",
        had_connector: false,
      }),
    );
    expect(logEvent).toHaveBeenCalledTimes(1);
  });
});

describe("public demo copy never shows the three words", () => {
  it("rewrites display strings and leaves identifiers alone", () => {
    const board = {
      id: "governance",
      tasks: [{ id: "oversight-1", name: "Governance", detail: "joint oversight committee" }],
      summary: "Modeled using FY25 audited data. YellowSigil's board sought governance changes.",
    };
    const out = neutralDemoCopy(board);
    expect(out.id).toBe("governance");
    expect(out.tasks[0]?.id).toBe("oversight-1");
    expect(out.tasks[0]?.name).toBe("Board structure");
    expect(out.tasks[0]?.detail).toBe("joint steering committee");
    expect(DEMO_BANNED_PATTERN.test(out.summary)).toBe(false);
  });

  it("the proof figures still parse after the swap", () => {
    const turn2 = neutralDemoText(
      "Working from the FY25 audited statements and the Meridian cost sheet from the 14 August call.",
    );
    expect(turn2).toContain("FY25 year-end statements");
    expect(parseLandingProof).toBeTypeOf("function");
    expect(/FY25 (?:audited|year-end) statements/.test(turn2)).toBe(true);
  });

  it("both public surfaces run the payload through the swap", () => {
    for (const path of ["src/components/marketing/LandingBoard.tsx", "src/pages/DemoPages.tsx"]) {
      expect(readFileSync(path, "utf8")).toContain("select: neutralDemoCopy");
    }
  });
});

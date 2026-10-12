// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const state: { grants: unknown[]; log: unknown[] } = { grants: [], log: [] };
const rpc = vi.fn(async () => ({ data: { status: "ok" }, error: null }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...a: unknown[]) => rpc(...(a as [])),
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          order: () => ({
            limit: async () => ({
              data: table === "support_grants" ? state.grants : state.log,
              error: null,
            }),
          }),
        }),
      }),
    }),
  },
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { role: "admin", org_id: "o1" } }),
}));
const logEvent = vi.fn();
vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));

import { SupportAccessCard, SUPPORT_COPY } from "@/components/settings/SupportAccessCard";
import { buildVariables } from "@/lib/email-queue.server";

const GID = "0f8a4b2a-1111-4222-8333-944445555666";

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SupportAccessCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpc.mockClear();
  logEvent.mockClear();
  state.grants = [];
  state.log = [];
});
afterEach(cleanup);

describe("SH-6d-1 buildVariables", () => {
  it("granted template with a valid id opens the grant", () => {
    const v = buildVariables({ GRANT_ID: GID }, "support-access-granted");
    expect(v["SUPPORT_URL"]).toBe(`https://lasso.charlotte-labs.com/support/${GID}`);
  });
  it("an invalid id falls back to settings", () => {
    const v = buildVariables({ GRANT_ID: "../x" }, "support-access-granted");
    expect(v["SUPPORT_URL"]).toBe("https://lasso.charlotte-labs.com/settings?section=support");
  });
  it("non-support templates get no SUPPORT_URL; REASON is escaped; DAYS is numeric", () => {
    const v = buildVariables({ REASON: "<b>x</b>", DAYS: "7" }, "workspace-invite");
    expect(v["SUPPORT_URL"]).toBeUndefined();
    expect(v["REASON"]).toBe("&lt;b&gt;x&lt;/b&gt;");
    expect(v["DAYS"]).toBe(7);
  });
});

describe("SH-6d-1 Support access card", () => {
  it("no grant shows the one line", async () => {
    mount();
    expect(await screen.findByText(SUPPORT_COPY.none)).toBeTruthy();
    expect(screen.getByText(SUPPORT_COPY.viewedEmpty)).toBeTruthy();
  });

  it("pending: Approve passes the checkbox value and days", async () => {
    state.grants = [
      { id: GID, reason: "Board will not load", days: 5, include_conversations: false, status: "requested", ends_at: null, created_at: "2026-10-12T00:00:00Z" },
    ];
    mount();
    expect(await screen.findByText(SUPPORT_COPY.asking)).toBeTruthy();
    expect(screen.getByText('"Board will not load"')).toBeTruthy();
    fireEvent.click(screen.getByLabelText(SUPPORT_COPY.includeConversations));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(rpc).toHaveBeenCalledWith("decide_support_access", {
        p_grant: GID,
        p_approve: true,
        p_days: 5,
        p_include_conversations: true,
      }),
    );
    await waitFor(() =>
      expect(logEvent).toHaveBeenCalledWith("support.decided", "o1", { approved: "true", conversations: "true" }),
    );
  });

  it("active: shows the end date, conversations line and ends access", async () => {
    state.grants = [
      { id: GID, reason: "r", days: 7, include_conversations: false, status: "active", ends_at: "2099-10-19T12:00:00Z", created_at: "2026-10-12T00:00:00Z" },
    ];
    state.log = [{ id: 1, surface: "board", at: "2026-10-12T10:00:00Z" }];
    mount();
    expect(await screen.findByText(/read only, until 19 Oct\./)).toBeTruthy();
    expect(screen.getByText(SUPPORT_COPY.convHidden)).toBeTruthy();
    expect(await screen.findByText(/^A board · /)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: SUPPORT_COPY.end }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("end_support_access", { p_grant: GID }));
  });

  it("copy has no em dash or banned words", () => {
    const text = Object.values(SUPPORT_COPY)
      .map((v) => (typeof v === "function" ? (v as (x: never) => string)("19 Oct" as never) : v))
      .join(" ");
    expect(text).not.toMatch(/\u2014|monitor|track|audit|surveillance|score/i);
  });
});

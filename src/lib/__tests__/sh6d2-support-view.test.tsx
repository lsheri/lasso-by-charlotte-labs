// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";

const state: { grant: Record<string, unknown> | null } = { grant: null };
const tables: string[] = [];
const rpc = vi.fn(async () => ({ data: null, error: null }));

function chain(table: string) {
  const result = () => {
    if (table === "support_grants") return { data: state.grant, error: null };
    if (table === "orgs") return { data: { name: "Acme", org_mode: "company" }, error: null };
    if (table === "work_items") return { data: [{ id: "w1", title: "Pricing memo", source: "chatgpt", captured_at: "2026-10-10T00:00:00Z", work_item_tasks: [] }], error: null };
    return { data: null, error: null, count: 0 };
  };
  const c: Record<string, unknown> = {};
  for (const m of ["select", "eq", "order", "limit", "in"]) c[m] = () => c;
  c["maybeSingle"] = async () => {
    const r = result();
    return table === "work_items" ? { data: { title: "Pricing memo" }, error: null } : r;
  };
  c["then"] = (res: (v: unknown) => unknown) => Promise.resolve(result()).then(res);
  return c;
}

vi.mock("@tanstack/react-router", async (orig) => ({
  ...(await orig<object>()),
  Link: ({ children }: { children: unknown }) => <a>{children as never}</a>,
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    rpc: (...a: unknown[]) => rpc(...(a as [])),
    from: (t: string) => {
      tables.push(t);
      return chain(t);
    },
  },
}));

import { SupportView } from "@/routes/support.$grantId";
import { isSupportPath } from "@/lib/support-view";
import { safeNext } from "@/lib/password-reset";

const GID = "0f8a4b2a-1111-4222-8333-944445555666";

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SupportView grantId={GID} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  rpc.mockClear();
  tables.length = 0;
  state.grant = null;
});
afterEach(cleanup);

describe("SH-6d-2 support view", () => {
  it("inactive grant shows only the not-active line", async () => {
    state.grant = { id: GID, org_id: "o1", reason: "r", include_conversations: false, status: "ended", ends_at: "2099-01-01T00:00:00Z" };
    mount();
    expect(await screen.findByText("This support access is not active.")).toBeTruthy();
    expect(screen.queryByTestId("support-banner")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("active grant: banner, home logged once, hidden conversations never query turns", async () => {
    state.grant = { id: GID, org_id: "o1", reason: "Board will not load", include_conversations: false, status: "active", ends_at: "2099-10-19T12:00:00Z" };
    mount();
    expect(await screen.findByText("Support view of Acme. Read only. Ends 19 Oct.")).toBeTruthy();
    expect(screen.getByText("Conversations: hidden")).toBeTruthy();
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("log_support_view", { p_org: "o1", p_surface: "home" }));
    expect(rpc.mock.calls.filter((c) => (c as unknown[])[1] && ((c as unknown[])[1] as { p_surface: string }).p_surface === "home")).toHaveLength(1);

    fireEvent.click(screen.getByRole("tab", { name: "All work" }));
    fireEvent.click(await screen.findByText("Pricing memo"));
    expect(await screen.findByText("Conversations are hidden for this support view.")).toBeTruthy();
    expect(tables).not.toContain("turns");
  });
});

describe("SH-6d-2 guards", () => {
  it("route has no telemetry, no profile machinery, no app shell", () => {
    const src = readFileSync("src/routes/support.$grantId.tsx", "utf8");
    expect(src).not.toContain("logEvent(");
    expect(src).not.toContain("useProfile(");
    expect(src).not.toMatch(/AppShell/);
  });
  it("return path allows only /support/<uuid>", () => {
    expect(isSupportPath(`/support/${GID}`)).toBe(true);
    expect(isSupportPath(`/support/${GID}/x`)).toBe(false);
    expect(isSupportPath("/support/abc")).toBe(false);
    expect(safeNext(`/support/${GID}`)).toBe(`/support/${GID}`);
    expect(safeNext("/support/abc")).toBeNull();
  });
});

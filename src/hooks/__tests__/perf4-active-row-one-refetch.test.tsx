// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const activeRowSelect = vi.fn();
const upsert = vi.fn();

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => getUser() },
    from(table: string) {
      if (table === "user_active_profile") {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: () => activeRowSelect() }),
          }),
          upsert: (...args: unknown[]) => {
            upsert(...args);
            return Promise.resolve({ error: null });
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    id: "p1",
                    user_id: "u1",
                    org_id: "o1",
                    role: "em",
                    display_name: "One",
                    title_band: null,
                    onboarding: null,
                    created_at: "2026-01-01",
                    deactivated_at: null,
                    orgs: { name: "Org one", settings: { type: "company" } },
                  },
                  {
                    id: "p2",
                    user_id: "u1",
                    org_id: "o2",
                    role: "em",
                    display_name: "Two",
                    title_band: null,
                    onboarding: null,
                    created_at: "2026-01-02",
                    deactivated_at: null,
                    orgs: { name: "Org two", settings: { type: "company" } },
                  },
                ],
                error: null,
              }),
          }),
        }),
      };
    },
  },
}));

const mod = await import("@/hooks/use-profile");
const {
  useProfile,
  setActiveProfileId,
  resetProfileIdentityState,
  registerProfileQueryClient,
  ACTIVE_PROFILE_ROW_KEY,
} = mod;

function Consumer() {
  const { data } = useProfile();
  return <span data-testid="who">{data?.id ?? "none"}</span>;
}

let client: QueryClient;

function renderMany(count: number) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  registerProfileQueryClient(client);
  return render(
    <QueryClientProvider client={client}>
      {Array.from({ length: count }, (_, i) => (
        <Consumer key={i} />
      ))}
    </QueryClientProvider>,
  );
}

let clock = 1_700_000_000_000;

beforeEach(() => {
  window.localStorage.clear();
  resetProfileIdentityState();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  activeRowSelect.mockReset().mockResolvedValue({ data: { profile_id: "p1" }, error: null });
  upsert.mockReset();
  // A real browser runs the consumers' effects a few milliseconds after the row arrives. Every read of the clock
  // moves it on, so this tab's own "last changed" stamp lands after the row's, as it does live.
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 5));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PERF-4: a fresh tab asks for the stored workspace row a bounded number of times", () => {
  it("re-reads the row once, not once per consumer, when this tab had no stored choice (Home made 35 requests)", async () => {
    renderMany(35);
    await waitFor(() => expect(screen.getAllByTestId("who")[0]?.textContent).toBe("p1"));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    // The first read, then at most one fresh read that every consumer joins.
    expect(activeRowSelect.mock.calls.length).toBeLessThanOrEqual(2);
    expect(window.localStorage.getItem("lasso.active_profile_id")).toBe("p1");
    // Nothing was written: reconciling follows the row, it never writes it.
    expect(upsert).not.toHaveBeenCalled();
  });

  it("still follows the row when this tab remembered another workspace", async () => {
    window.localStorage.setItem("lasso.active_profile_id", "p2");
    activeRowSelect.mockResolvedValue({ data: { profile_id: "p1" }, error: null });
    renderMany(20);
    await waitFor(() => expect(screen.getAllByTestId("who")[0]?.textContent).toBe("p1"));
    expect(window.localStorage.getItem("lasso.active_profile_id")).toBe("p1");
    expect(upsert).not.toHaveBeenCalled();
  });
});

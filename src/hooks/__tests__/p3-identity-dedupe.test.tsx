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
  // The app root registers the same way; see src/routes/__root.tsx.
  registerProfileQueryClient(client);
  return render(
    <QueryClientProvider client={client}>
      {Array.from({ length: count }, (_, i) => (
        <Consumer key={i} />
      ))}
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  resetProfileIdentityState();
  getUser.mockReset().mockResolvedValue({ data: { user: { id: "u1" } } });
  activeRowSelect.mockReset().mockResolvedValue({ data: { profile_id: "p1" }, error: null });
  upsert.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("P3 - one identity read per session", () => {
  it("resolves the user and the stored workspace once for many consumers", async () => {
    renderMany(40);
    await waitFor(() => expect(screen.getAllByTestId("who")[0]?.textContent).toBe("p1"));
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(activeRowSelect).toHaveBeenCalledTimes(1);
  });

  it("seeds the stored workspace once, not once per consumer", async () => {
    activeRowSelect.mockResolvedValue({ data: null, error: null });
    renderMany(25);
    await waitFor(() => expect(upsert).toHaveBeenCalled());
    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("invalidates the stored workspace the moment someone switches", async () => {
    renderMany(3);
    await waitFor(() => expect(screen.getAllByTestId("who")[0]?.textContent).toBe("p1"));
    activeRowSelect.mockResolvedValue({ data: { profile_id: "p2" }, error: null });

    await act(async () => {
      await setActiveProfileId("p2");
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", profile_id: "p2" }),
      expect.anything(),
    );
    await waitFor(() =>
      expect(client.getQueryData([...ACTIVE_PROFILE_ROW_KEY, "u1"])).toBe("p2"),
    );
    await waitFor(() => expect(screen.getAllByTestId("who")[0]?.textContent).toBe("p2"));
  });
});

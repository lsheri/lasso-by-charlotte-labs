// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  row: null as string | null,
  upsertError: null as null | { message: string },
  upserts: [] as string[],
  profiles: [] as unknown[],
}));
const logEvent = vi.hoisted(() => vi.fn());
const navigate = vi.hoisted(() => vi.fn());

vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => logEvent(...a) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("@tanstack/react-router", () => ({ useRouter: () => ({ navigate }) }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
    },
    from: (table: string) => {
      if (table === "profiles") {
        return { select: () => ({ eq: () => ({ order: async () => ({ data: db.profiles, error: null }) }) }) };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: db.row ? { profile_id: db.row } : null, error: null }),
          }),
        }),
        upsert: async (row: { profile_id: string }) => {
          if (db.upsertError) return { error: db.upsertError };
          db.upserts.push(row.profile_id);
          db.row = row.profile_id;
          return { error: null };
        },
      };
    },
  },
}));

import { OrgSwitcher } from "@/components/layout/OrgSwitcher";
import {
  registerProfileQueryClient,
  resetProfileIdentityState,
  setActiveProfileId,
  useProfile,
  type Profile,
} from "@/hooks/use-profile";

const KEY = "lasso.active_profile_id";

function row(id: string, org: string, name: string) {
  return {
    id, user_id: "u1", org_id: org, role: "em", display_name: "Liam", title_band: null,
    onboarding: null, created_at: null, deactivated_at: null,
    orgs: { name, settings: { type: "company" }, clients_enabled: true },
  };
}

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  resetProfileIdentityState();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  registerProfileQueryClient(client);
  db.profiles = [row("a", "oa", "Northline"), row("b", "ob", "Bright Path")];
  db.row = null;
  db.upsertError = null;
  db.upserts = [];
  window.localStorage.clear();
  logEvent.mockClear();
  navigate.mockClear();
});
afterEach(() => cleanup());

describe("MN-1: the active workspace has one truth", () => {
  it("the database row beats localStorage, and reconcile writes the cache and logs once", async () => {
    window.localStorage.setItem(KEY, "a");
    db.row = "b";
    const { result, rerender } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("b"));
    await waitFor(() => expect(window.localStorage.getItem(KEY)).toBe("b"));
    rerender();
    rerender();
    const reconciled = logEvent.mock.calls.filter((c) => c[0] === "profile.active_reconciled");
    expect(reconciled).toEqual([["profile.active_reconciled", "ob", { source: "row_differs" }]]);
    expect(db.upserts).toEqual([]);
  });

  it("no row falls back to localStorage, then to the first profile", async () => {
    window.localStorage.setItem(KEY, "b");
    const first = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(first.result.current.data?.id).toBe("b"));
    first.unmount();

    resetProfileIdentityState();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    registerProfileQueryClient(client);
    db.row = null;
    window.localStorage.clear();
    const second = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(second.result.current.data?.id).toBe("a"));
    expect(logEvent.mock.calls.some((c) => c[0] === "profile.active_reconciled")).toBe(false);
  });

  it("a failed upsert leaves localStorage and the label unchanged", async () => {
    window.localStorage.setItem(KEY, "a");
    db.row = "a";
    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.data?.id).toBe("a"));
    db.upsertError = { message: "nope" };
    let accepted = true;
    await act(async () => {
      accepted = await setActiveProfileId("b");
    });
    expect(accepted).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe("a");
    expect(result.current.data?.id).toBe("a");
  });

  function profiles(): Profile[] {
    return [
      { id: "a", user_id: "u1", org_id: "oa", role: "em", display_name: "Liam", title_band: null, org_name: "Northline", org_type: "company", clients_enabled: true, onboarding: null },
      { id: "b", user_id: "u1", org_id: "ob", role: "coach", display_name: "Liam", title_band: null, org_name: "Bright Path", org_type: "company", clients_enabled: true, onboarding: null },
    ];
  }

  it("re-picking the shown workspace upserts the row and logs no switch", async () => {
    const [a, b] = profiles();
    render(createElement(wrapper, null, createElement(OrgSwitcher, { profiles: [a!, b!], active: a! })));
    fireEvent.click(screen.getByRole("button", { name: /change workspace/i }));
    fireEvent.click(screen.getByText("Northline"));
    await waitFor(() => expect(db.upserts).toEqual(["a"]));
    expect(logEvent.mock.calls.some((c) => c[0] === "profile.switched")).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("a real switch upserts, then lands on the sign-in landing route", async () => {
    const [a, b] = profiles();
    render(createElement(wrapper, null, createElement(OrgSwitcher, { profiles: [a!, b!], active: a! })));
    fireEvent.click(screen.getByRole("button", { name: /change workspace/i }));
    fireEvent.click(screen.getByText("Bright Path"));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/home", replace: true }));
    expect(db.upserts).toEqual(["b"]);
    expect(window.localStorage.getItem(KEY)).toBe("b");
    expect(logEvent.mock.calls.filter((c) => c[0] === "profile.switched")).toHaveLength(1);
  });
});

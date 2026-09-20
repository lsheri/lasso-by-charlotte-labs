// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";
import { ClientPage } from "@/pages/ClientPage";

const mocks = vi.hoisted(() => ({
  events: [] as { name: string; dims: Record<string, unknown> }[],
  dialogs: [] as { initialClientId?: string | null; from?: string }[],
}));

vi.mock("@/lib/telemetry", () => ({
  logEvent: (name: string, _org: string, dims: Record<string, unknown>) =>
    mocks.events.push({ name, dims }),
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", org_type: "company" } }),
}));

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: [{ id: "cl1", name: "Northwind", quick_folder: false }] }),
  useInvalidateClients: () => () => {},
  createClient: async () => "cl2",
  renameClient: async () => {},
  createQuickFolder: async () => ({ engagementId: "e1" }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) => ({
    data:
      queryKey[0] === "client"
        ? { id: "cl1", name: "Northwind", code: null, quick_folder: false }
        : [],
    isLoading: false,
    isSuccess: true,
  }),
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => () => {} }));

vi.mock("@/hooks/use-work-items", () => ({ useWorkItems: () => ({ data: { items: [] } }) }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: async () => ({ error: null }),
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null }), order: async () => ({ data: [] }) }),
      }),
    }),
  },
}));

afterEach(() => {
  cleanup();
  mocks.events = [];
  mocks.dialogs = [];
});

describe("C1 the from dim", () => {
  it("carries the entry point alongside the existing dims", async () => {
    render(
      <NewEngagementDialog
        initialClientId="cl1"
        from="client_page"
        trigger={<button type="button">open</button>}
      />,
    );
    fireEvent.click(screen.getByText("open"));
    fireEvent.click(screen.getByText("Full engagement"));
    expect((screen.getByLabelText("Client (optional)") as HTMLSelectElement).value).toBe("cl1");
    fireEvent.change(screen.getByLabelText("Code"), { target: { value: "NW-1" } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Pricing" } });
    fireEvent.change(screen.getByLabelText("Brief (optional)"), { target: { value: "A brief." } });
    fireEvent.click(screen.getByText("Create engagement"));

    await waitFor(() => expect(mocks.events.length).toBe(1));
    expect(mocks.events[0]).toEqual({
      name: "engagement.updated",
      dims: {
        created: "true",
        brief_skipped: "false",
        has_client: "true",
        from: "client_page",
      },
    });
  });
});

vi.mock("@/components/engagements/NewEngagementDialog", async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return actual;
});

describe("C1 the client page entry point", () => {
  it("offers a new engagement with the client already chosen", () => {
    render(<ClientPage clientId="cl1" />);
    fireEvent.click(screen.getByText("New engagement"));
    expect((screen.getByLabelText("Client (optional)") as HTMLSelectElement).value).toBe("cl1");
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NewEngagementDialog } from "@/components/engagements/NewEngagementDialog";

// Records every supabase call in order so the tests can assert that the
// default-workstream RPC runs after the membership insert, and only then.
const mocks = vi.hoisted(() => ({
  calls: [] as { kind: string; table?: string; args?: unknown }[],
  memberFailures: 0,
  rpcThrows: false,
  navigated: [] as string[],
}));

vi.mock("@/lib/telemetry", () => ({ logEvent: () => {} }));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", org_type: "company" } }),
}));

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: [] }),
  useInvalidateClients: () => () => {},
  createClient: async () => "cl2",
  renameClient: async () => {},
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
  useQuery: () => ({ data: [], isLoading: false, isSuccess: true }),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => (opts: { params?: { id?: string } }) => {
    mocks.navigated.push(opts?.params?.id ?? "");
  },
  useRouter: () => ({
    state: { matches: [] },
    subscribe: () => () => {},
    invalidate: async () => {},
    navigate: async () => {},
    options: {},
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      insert: async (row: unknown) => {
        mocks.calls.push({ kind: "insert", table, args: row });
        if (table === "engagement_members" && mocks.memberFailures > 0) {
          mocks.memberFailures -= 1;
          return { error: { message: "membership refused" } };
        }
        return { error: null };
      },
    }),
    rpc: async (name: string, args: unknown) => {
      mocks.calls.push({ kind: "rpc", table: name, args });
      if (mocks.rpcThrows) throw new Error("rpc unavailable");
      return { data: "task-1", error: null };
    },
  },
}));

afterEach(() => {
  cleanup();
  mocks.calls = [];
  mocks.memberFailures = 0;
  mocks.rpcThrows = false;
  mocks.navigated = [];
});

function createBoard() {
  render(<NewEngagementDialog trigger={<button type="button">open</button>} />);
  fireEvent.click(screen.getByText("open"));
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Pricing" } });
  fireEvent.change(screen.getByLabelText("Brief (optional)"), { target: { value: "A brief." } });
  fireEvent.click(screen.getByText("Create workboard"));
}

describe("WS1 a new board always has somewhere for work to land", () => {
  it("asks for the default workstream once, after the membership insert", async () => {
    createBoard();
    await waitFor(() => expect(mocks.navigated.length).toBe(1));

    const rpcCalls = mocks.calls.filter((c) => c.kind === "rpc");
    expect(rpcCalls).toEqual([
      { kind: "rpc", table: "ensure_board_default_task", args: { p_engagement: mocks.navigated[0] } },
    ]);

    const memberAt = mocks.calls.findIndex((c) => c.kind === "insert" && c.table === "engagement_members");
    const rpcAt = mocks.calls.findIndex((c) => c.kind === "rpc");
    expect(memberAt).toBeGreaterThanOrEqual(0);
    expect(rpcAt).toBeGreaterThan(memberAt);
  });

  it("still asks after the one membership retry", async () => {
    mocks.memberFailures = 1;
    createBoard();
    await waitFor(() => expect(mocks.navigated.length).toBe(1));
    expect(mocks.calls.filter((c) => c.kind === "rpc").length).toBe(1);
  });

  it("skips the call when membership never succeeds", async () => {
    mocks.memberFailures = 2;
    createBoard();
    await waitFor(() =>
      expect(screen.getByText(/not attached/i)).toBeTruthy(),
    );
    expect(mocks.calls.filter((c) => c.kind === "rpc").length).toBe(0);
    expect(mocks.navigated.length).toBe(0);
  });

  it("is best effort: a failed call does not block or complain", async () => {
    mocks.rpcThrows = true;
    createBoard();
    await waitFor(() => expect(mocks.navigated.length).toBe(1));
    expect(screen.queryByText(/could not/i)).toBeNull();
  });

  it("never fires a workstream telemetry event for the automatic one", async () => {
    createBoard();
    await waitFor(() => expect(mocks.navigated.length).toBe(1));
    // The dialog's only event is engagement.updated; nothing names a
    // workstream, so an automatic default cannot inflate a count.
    const source = readFileSync("src/components/engagements/NewEngagementDialog.tsx", "utf8");
    expect(source.match(/logEvent\(/g)?.length).toBe(1);
  });

  it("keeps the lazy path as the backstop", () => {
    // The RPC itself is idempotent twice over (selects an existing default
    // first; unique index tasks_one_board_default behind it), confirmed
    // against the live database. What this test pins is that the lazy call
    // on first placement still exists, so a board whose dialog-time attempt
    // failed still gets its default later, and a board that already has one
    // is not given a second.
    const source = readFileSync("src/lib/workboard-add-work.functions.ts", "utf8");
    expect(source).toContain('rpc("ensure_board_default_task"');
  });
});

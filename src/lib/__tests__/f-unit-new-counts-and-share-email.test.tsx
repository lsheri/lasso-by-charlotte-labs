// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { readFileSync } from "node:fs";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  rpcCalls: [] as { fn: string; args?: unknown }[],
  upserts: [] as unknown[],
  sends: [] as { template: string; variables: Record<string, unknown>; to: string }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(async (fn: string) => {
      m.rpcCalls.push({ fn });
      return { data: [{ engagement_id: "e-1", new_count: 3 }, { engagement_id: "e-2", new_count: 12 }, { engagement_id: "e-3", new_count: 0 }], error: null };
    }),
    from: () => ({
      upsert: async (row: unknown) => {
        m.upserts.push(row);
        return { error: null };
      },
    }),
  },
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p-me" } }) }));
vi.mock("@/integrations/supabase/client.server", () => {
  const chain = (row: unknown) => {
    const c: Record<string, unknown> = {};
    for (const k of ["select", "eq"]) c[k] = () => c;
    c["maybeSingle"] = async () => ({ data: row });
    return c;
  };
  return {
    supabaseAdmin: {
      from: (t: string) => (t === "engagements" ? chain({ title: "<b>Q3</b>", org_id: "o-1" }) : chain({ user_id: "u-2", display_name: "<b>Ana</b>" })),
      rpc: async (fn: string, args: unknown) => {
        m.rpcCalls.push({ fn, args });
        return { error: null };
      },
      auth: { admin: { getUserById: async () => ({ data: { user: { email: "bo@x.com" } } }) } },
    },
  };
});
vi.mock("@/lib/invites.server", () => ({
  resendApiKey: () => "k",
  sendResendTemplate: async (_k: string, mail: { template: string; variables: Record<string, unknown>; to: string }) => {
    m.sends.push(mail);
    return { ok: true };
  },
}));

import { BoardNewPill, NewCountPill } from "@/components/board/BoardNewPill";
import { useRecordEngagementView } from "@/hooks/use-engagement-views";
import { BOARD_NEW_COUNTS_KEY } from "@/hooks/use-board-new-counts";
import { notifyBoardShared } from "@/lib/board-invite-email.server";
import { shouldNotifyShare } from "@/lib/board-share-notify";
import { coachScopeLine } from "@/lib/invites-shared";

afterEach(cleanup);
beforeEach(() => {
  m.rpcCalls = [];
  m.upserts = [];
  m.sends = [];
});

const wrap = (qc: QueryClient) => ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={qc}>{children}</QueryClientProvider>
);

describe("F3 N NEW", () => {
  it("renders 3 NEW and 9+ NEW, and nothing at 0", () => {
    const { container, rerender } = render(<NewCountPill count={3} />);
    expect(container.textContent).toBe("3 NEW");
    rerender(<NewCountPill count={12} />);
    expect(container.textContent).toBe("9+ NEW");
    rerender(<NewCountPill count={0} />);
    expect(container.textContent).toBe("");
  });

  it("one counts query is shared across rows", async () => {
    const qc = new QueryClient();
    const W = wrap(qc);
    render(
      <W>
        <BoardNewPill engagementId="e-1" />
        <BoardNewPill engagementId="e-2" />
        <BoardNewPill engagementId="e-3" />
      </W>,
    );
    expect(await screen.findByText("3 NEW")).toBeTruthy();
    expect(screen.getByText("9+ NEW")).toBeTruthy();
    expect(m.rpcCalls.filter((c) => c.fn === "board_new_counts").length).toBe(1);
  });

  it("opening a board upserts the view and invalidates the counts", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");
    function Open() {
      useRecordEngagementView("e-1");
      return null;
    }
    const W = wrap(qc);
    render(<W><Open /></W>);
    await waitFor(() => expect(spy).toHaveBeenCalledWith({ queryKey: BOARD_NEW_COUNTS_KEY }));
    expect(m.upserts[0]).toMatchObject({ profile_id: "p-me", engagement_id: "e-1" });
    expect(readFileSync("src/pages/CanvasLabPage.tsx", "utf8")).toContain("useRecordEngagementView(engagementId)");
  });
});

describe("F6 board-shared", () => {
  it("sends with escaped variables and the canonical URL, and writes the bell row", async () => {
    await notifyBoardShared({ engagementId: "e-9", recipientProfileId: "p-2", sharerProfileId: "p-me", level: "review", conversations: "summaries" });
    const mail = m.sends[0]!;
    expect(mail.template).toBe("board-shared");
    expect(mail.to).toBe("bo@x.com");
    expect(mail.variables).toEqual({
      SHARER_NAME: "bAna/b",
      BOARD_NAME: "bQ3/b",
      ACCESS_LINE: "You can view the cards and their summaries.",
      OPEN_URL: "https://lasso.charlotte-labs.com/engagements/e-9/canvas-lab",
    });
    const notify = m.rpcCalls.find((c) => c.fn === "notify")!;
    expect(notify.args).toEqual({
      p_recipient: "p-2",
      p_org: "o-1",
      p_kind: "share_received",
      p_section: "updates",
      p_subject_type: "engagement",
      p_subject_id: "e-9",
      p_group_key: "share:e-9",
      p_payload: { board: "<b>Q3</b>" },
    });
  });

  it("is not called for self-adds or level changes", () => {
    expect(shouldNotifyShare("granted", "p-2", "p-me")).toBe(true);
    expect(shouldNotifyShare("granted", "p-me", "p-me")).toBe(false);
    expect(shouldNotifyShare("changed", "p-2", "p-me")).toBe(false);
    expect(shouldNotifyShare("unchanged", "p-2", "p-me")).toBe(false);
    expect(shouldNotifyShare("removed", "p-2", "p-me")).toBe(false);
    const conv = readFileSync("src/lib/engagement-access.functions.ts", "utf8");
    const convFn = conv.slice(conv.indexOf("export const setPersonConversationsFn"));
    expect(convFn).not.toContain("notifyBoardShared");
  });
});

describe("Small fix A", () => {
  it("coachScopeLine has the new wording", () => {
    expect(coachScopeLine(["Ada"])).toBe(
      "You will see only the work Ada chooses to share with you. Nothing else in the workspace is visible to you.",
    );
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

afterEach(cleanup);

vi.mock("@tanstack/react-router", async (orig) => {
  const actual = await orig<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ to, search, children }: { to: string; search?: Record<string, string>; children: React.ReactNode }) => (
      <a href={`${to}?${new URLSearchParams(search ?? {}).toString()}`}>{children}</a>
    ),
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: {} } }));
const inviteState = vi.hoisted(() => ({
  listCalls: 0,
  rows: [] as { id: string; email: string; level: string; conversations: string; status: string }[],
}));
vi.mock("@/lib/board-invites.functions", () => ({
  claimBoardInvite: vi.fn(),
  previewBoardInvite: vi.fn(),
  inviteToBoard: vi.fn(async () => {
    inviteState.rows = [{ id: "i-1", email: "jo@x.com", level: "review", conversations: "summaries", status: "sent" }];
    return { ok: true, status: "sent", emailed: true };
  }),
  listBoardInvites: vi.fn(async () => {
    inviteState.listCalls += 1;
    return inviteState.rows;
  }),
  withdrawBoardInvite: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({
    canShare: true,
    people: [{ id: "p-me", display_name: "Liam", access: "work", isYou: true }],
  })),
  setEngagementPersonAccessFn: vi.fn(async () => ({ status: "done", result: "granted" })),
  setPersonConversationsFn: vi.fn(async () => ({ status: "done", result: "unchanged" })),
}));
vi.mock("@/lib/board-share.functions", () => ({
  listBoardShareLinksFn: vi.fn(async () => ({ links: [], holdsOthersWork: false, canShare: true })),
  createBoardShareLinkFn: vi.fn(async () => ({ status: "error" })),
  expireBoardShareLinkFn: vi.fn(async () => ({ status: "not_found" })),
}));
vi.mock("@/hooks/use-profile", () => ({ setActiveProfileId: vi.fn() }));
vi.mock("@/components/layout/SessionHeader", () => ({ SessionHeader: () => null }));

import { BoardInviteCard } from "@/routes/board-invite";
import {
  CONVERSATIONS_FROM_LABEL,
  LEVEL_FROM_LABEL,
  boardInviteReturnPath,
  inviteResultLine,
  isBoardInvitePath,
  looksLikeEmail,
  type BoardInvitePreview,
} from "@/lib/board-invites-shared";
import { buildReviewUrl } from "@/lib/board-invite-email.server";
import { EVENT_DIM_KEYS } from "@/lib/event-dim-allowlist";

const base: BoardInvitePreview = { state: "sent", board: "Pricing", by: "Ana", kind: "peer", email_hint: "j***@x.com" };

describe("SH-5c add field", () => {
  it("only a whole address is an email; names stay a name search", () => {
    expect(looksLikeEmail("jo@x.com")).toBe(true);
    expect(looksLikeEmail("Owen")).toBe(false);
    expect(looksLikeEmail("owen@")).toBe(false);
    expect(looksLikeEmail("jo@x")).toBe(false);
  });
  it("maps level and conversations", () => {
    expect(LEVEL_FROM_LABEL).toEqual({ Viewer: "review", Collaborator: "work" });
    expect(CONVERSATIONS_FROM_LABEL).toEqual({ Summaries: "summaries", "Full conversations": "full" });
  });
  it("result lines", () => {
    expect(inviteResultLine({ status: "sent", emailed: true })).toBe("Invite sent.");
    expect(inviteResultLine({ status: "sent", emailed: false })).toBe("Invite saved. The email did not send.");
    expect(inviteResultLine({ status: "pending_approval", emailed: true })).toBe("An admin needs to approve this first.");
  });
  it("REVIEW_URL form", () => {
    expect(buildReviewUrl()).toBe("https://lasso.charlotte-labs.com/home?notifications=open");
  });
});

describe("SH-5d accept page", () => {
  it("sent, signed out: heading, hint, and both buttons return here", () => {
    render(<BoardInviteCard preview={base} code="AB C" signedIn={false} />);
    expect(screen.getByText("Ana invited you to Pricing")).toBeTruthy();
    expect(screen.getByText("Use the address this was sent to: j***@x.com.")).toBeTruthy();
    const next = boardInviteReturnPath("AB C");
    for (const label of ["Sign in", "Create an account"]) {
      const href = screen.getByText(label).closest("a")!.getAttribute("href")!;
      expect(new URLSearchParams(href.split("?")[1]).get("next")).toBe(next);
    }
    expect(isBoardInvitePath(next)).toBe(true);
    expect(new URLSearchParams(next.split("?")[1]).get("code")).toBe("AB C");
  });
  it("sent, signed in: Accept, and a mismatch shows the line with Sign out", () => {
    render(<BoardInviteCard preview={base} code="c" signedIn error="This invite was sent to j***@x.com. Sign in with that address." />);
    expect(screen.getByText("Accept")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Sign in with that address.");
    expect(screen.getByText("Sign out")).toBeTruthy();
  });
  it.each([
    ["pending_approval", "This invite is waiting for an admin to approve it."],
    ["accepted", "This invite was already accepted."],
    ["expired", "This invite is no longer open. Ask Ana for a new one."],
    ["declined", "This invite is no longer open. Ask Ana for a new one."],
    ["withdrawn", "This invite is no longer open. Ask Ana for a new one."],
    ["not_found", "This invite does not exist."],
  ] as const)("%s", (state, line) => {
    render(<BoardInviteCard preview={{ ...base, state }} code="c" signedIn={false} />);
    expect(screen.getByText(line)).toBeTruthy();
  });
  it("accepted signed in offers Open the board", () => {
    render(<BoardInviteCard preview={{ ...base, state: "accepted" }} code="c" signedIn onOpenBoard={() => {}} />);
    expect(screen.getByText("Open the board")).toBeTruthy();
  });
});

describe("telemetry", () => {
  it("three events allowlisted with closed dims", () => {
    expect(EVENT_DIM_KEYS["board.invite_sent"]).toEqual(["conversations", "kind", "level", "status"]);
    expect(EVENT_DIM_KEYS["board.invite_withdrawn"]).toEqual(["kind"]);
    expect(EVENT_DIM_KEYS["board.invite_accepted"]).toEqual(["kind"]);
  });
});

describe("SH-5c-fix the Invited group refreshes", () => {
  it("a successful invite refetches the list and the new row renders with Withdraw", async () => {
    const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
    const { ShareDialog } = await import("@/components/canvas-lab/ShareDialog");
    const { fireEvent, waitFor } = await import("@testing-library/react");
    inviteState.listCalls = 0;
    inviteState.rows = [];
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ShareDialog engagementId="e-1" profileId="p-me" />
      </QueryClientProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText("You");
    await waitFor(() => expect(inviteState.listCalls).toBe(1));
    expect(screen.getByText("Nobody else in your workspace yet.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Add people by name or email"), { target: { value: "jo@x.com" } });
    expect(screen.queryByText("Nobody else in your workspace yet.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Invite jo@x.com" }));

    await waitFor(() => expect(inviteState.listCalls).toBeGreaterThan(1));
    const group = await screen.findByRole("group", { name: "Invited" });
    expect(group.textContent).toContain("jo@x.com");
    expect(screen.getByRole("button", { name: "Withdraw" })).toBeTruthy();
  });
});

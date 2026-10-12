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
vi.mock("@/lib/board-invites.functions", () => ({ claimBoardInvite: vi.fn(), previewBoardInvite: vi.fn() }));
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

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  tier: "business" as "business" | "individual",
  setAccess: vi.fn(async (_input: unknown) => ({ status: "done", result: "granted" })),
  setConversations: vi.fn(async (_input: unknown) => ({ status: "done", result: "changed" })),
  invite: vi.fn(async (_input: { data: { email: string } }) => ({ ok: true, status: "sent", emailed: true }) as
    | { ok: true; status: string; emailed: boolean }
    | { ok: false; error: string }),
  logEvent: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({ logEvent: (...a: unknown[]) => m.logEvent(...a) }));
vi.mock("@/hooks/use-profile", () => ({
  ensureProfileState: async () => ({ profiles: [{ id: "p1", org_id: "org1" }], hasDeactivated: false }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/canvas-lab/ShareBoardDialog", () => ({ BoardLinkSection: () => null }));
vi.mock("@/lib/board-invites.functions", () => ({
  inviteToBoard: m.invite,
  listBoardInvites: vi.fn(async () => []),
  withdrawBoardInvite: vi.fn(),
}));
vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({
    canShare: true,
    workspaceTier: m.tier,
    people: [
      { id: "p1", display_name: "Liam", access: "work", isYou: true, email: "liam@co.com" },
      { id: "p2", display_name: "Ana Ruiz", access: null, isYou: false, email: "ana@co.com" },
      { id: "p4", display_name: "Cleo Fern", access: null, isYou: false, email: "cleo@co.com" },
    ],
  })),
  setEngagementPersonAccessFn: m.setAccess,
  setPersonConversationsFn: m.setConversations,
}));
vi.mock("@/lib/partner-share", () => ({
  getBoardConversationAccess: vi.fn(), listMyPartnerShares: vi.fn(async () => []),
  setBoardConversationAccess: vi.fn(), listSharedEngagements: vi.fn(async () => []),
  partnerShareLabel: () => "", shareEngagement: vi.fn(), unshareEngagement: vi.fn(),
}));

import { ShareDialog } from "@/components/canvas-lab/ShareDialog";
import { parseEmailList, inviteCountBand } from "@/lib/board-invites-shared";

async function openDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ShareDialog engagementId="e1" profileId="p1" />
    </QueryClientProvider> as ReactNode,
  );
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  const field = await screen.findByLabelText("Email addresses");
  await waitFor(() => expect((field as HTMLTextAreaElement).disabled).toBe(false));
}

const emailGroup = () => screen.getByRole("group", { name: "Invite by email" });

function sendButton() {
  const buttons = screen.getByRole("dialog").querySelectorAll<HTMLButtonElement>('[data-share-send="all"]');
  expect(buttons).toHaveLength(1);
  const button = buttons[0];
  if (!button) throw new Error("Missing combined Send button");
  return button;
}

beforeEach(() => {
  vi.clearAllMocks();
  m.tier = "business";
});
afterEach(cleanup);

describe("SHARE-3 parsing", () => {
  it("splits on commas, semicolons, spaces and newlines, lowercases and dedupes", () => {
    expect(parseEmailList("A@x.com, b@x.com;c@x.com\nd@x.com  a@X.com nope")).toEqual({
      valid: ["a@x.com", "b@x.com", "c@x.com", "d@x.com"],
      invalid: ["nope"],
      overCap: [],
    });
  });
  it("caps one Send at 20 addresses", () => {
    const text = Array.from({ length: 22 }, (_, i) => `p${i}@x.com`).join(",");
    const out = parseEmailList(text);
    expect(out.valid).toHaveLength(20);
    expect(out.overCap).toEqual(["p20@x.com", "p21@x.com"]);
  });
  it("bands the count", () => {
    expect([inviteCountBand(1), inviteCountBand(5), inviteCountBand(6), inviteCountBand(20)]).toEqual(["1", "2-5", "6-20", "6-20"]);
  });
});

describe("SHARE-3 dialog", () => {
  it("business workspace shows the roster, email and link sections", async () => {
    await openDialog();
    expect(screen.getByRole("group", { name: "People in this workspace" })).toBeTruthy();
    expect(emailGroup()).toBeTruthy();
    expect(screen.getByText("Anyone with the link can view this board. No account needed. They cannot edit, and the link expires.")).toBeTruthy();
  });

  it("individual workspace shows email and link, no roster", async () => {
    m.tier = "individual";
    await openDialog();
    expect(screen.queryByRole("group", { name: "People in this workspace" })).toBeNull();
    expect(emailGroup()).toBeTruthy();
    expect(screen.getByText("Enter one address or several, separated by commas. Each person gets an email with a link to accept the board.")).toBeTruthy();
    expect(screen.getByText("Anyone with the link can view this board. No account needed. They cannot edit, and the link expires.")).toBeTruthy();
  });

  it("several colleagues are added in one Send, only on Send", async () => {
    await openDialog();
    const roster = screen.getByRole("group", { name: "People in this workspace" });
    fireEvent.click(within(roster).getByRole("button", { name: /Ana Ruiz/ }));
    fireEvent.click(within(roster).getByRole("button", { name: /Cleo Fern/ }));
    expect(m.setAccess).not.toHaveBeenCalled();
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(2));
    expect(m.setAccess.mock.calls.map((c) => (c[0] as { data: { person_id: string } }).data.person_id)).toEqual(["p2", "p4"]);
  });

  it("reports each address, keeps failures in the field and clears successes", async () => {
    m.invite.mockImplementation(async ({ data }) => {
      if (data.email === "bad@else.com") return { ok: false, error: "That invite could not be made." };
      if (data.email === "quiet@else.com") return { ok: true, status: "sent", emailed: false };
      return { ok: true, status: "sent", emailed: true };
    });
    await openDialog();
    const field = screen.getByLabelText("Email addresses") as HTMLTextAreaElement;
    fireEvent.change(field, { target: { value: "ok@else.com, bad@else.com; quiet@else.com" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.invite).toHaveBeenCalledTimes(3));
    const results = await screen.findByRole("status", { name: "Results for email invites" });
    await waitFor(() => expect(results.querySelectorAll("li")).toHaveLength(3));
    const outcome = (address: string) =>
      Array.from(results.querySelectorAll("li")).find((li) => li.textContent?.startsWith(address))?.getAttribute("data-send-outcome");
    expect(outcome("ok@else.com")).toBe("sent");
    expect(outcome("bad@else.com")).toBe("refused");
    expect(outcome("quiet@else.com")).toBe("not_emailed");
    expect(results.textContent).toContain("Invite created, email did not go");
    expect(field.value).toBe("bad@else.com");
    await waitFor(() =>
      expect(m.logEvent).toHaveBeenCalledWith("board.invite_batch_sent", "org1", { count_band: "2-5", sent: 2, failed: 1, skipped: 0 }),
    );
  });

  it("a colleague's address grants access and is never invited", async () => {
    await openDialog();
    fireEvent.change(screen.getByLabelText("Email addresses"), { target: { value: "ana@co.com" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(1));
    expect(m.setAccess).toHaveBeenCalledWith({
      data: { engagement_id: "e1", profile_id: "p1", person_id: "p2", access: "review", conversations: "full" },
    });
    await waitFor(() => expect(m.setConversations).toHaveBeenCalledWith({
      data: { engagement_id: "e1", profile_id: "p1", person_id: "p2", conversations: "full" },
    }));
    expect(m.invite).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog").textContent).not.toMatch(/add them from the list above/i);
  });

  it("keeps an empty Send enabled and explains what is missing when clicked", async () => {
    await openDialog();
    expect(sendButton().disabled).toBe(false);
    fireEvent.click(sendButton());
    const alerts = await within(screen.getByRole("dialog")).findAllByRole("alert");
    for (const alert of alerts) expect(alert.textContent).toBe("Pick someone from the list or enter an email address first.");
    expect(m.setAccess).not.toHaveBeenCalled();
    expect(m.setConversations).not.toHaveBeenCalled();
    expect(m.invite).not.toHaveBeenCalled();
  });
});

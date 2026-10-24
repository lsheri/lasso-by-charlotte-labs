// @vitest-environment jsdom
// TEMPORARY verification harness for SHARE-4b. Deleted after the run.
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  roster: [] as {
    id: string; display_name: string; access: string | null; isYou: boolean; email?: string;
  }[],
  setAccess: vi.fn(async (_input: unknown) => ({ status: "done", result: "granted" })),
  setConversations: vi.fn(async (_input: unknown) => ({ status: "done", result: "changed" })),
  invite: vi.fn(async (_input: unknown) => ({ ok: true, status: "sent", emailed: true })),
  listInvites: vi.fn(async () => []),
}));

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/hooks/use-profile", () => ({
  ensureProfileState: async () => ({ profiles: [{ id: "p1", org_id: "org1" }], hasDeactivated: false }),
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/components/canvas-lab/ShareBoardDialog", () => ({ BoardLinkSection: () => null }));
vi.mock("@/lib/board-invites.functions", () => ({
  inviteToBoard: m.invite,
  listBoardInvites: m.listInvites,
  withdrawBoardInvite: vi.fn(),
}));
vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({ canShare: true, people: m.roster })),
  setEngagementPersonAccessFn: m.setAccess,
  setPersonConversationsFn: m.setConversations,
}));
vi.mock("@/lib/partner-share", () => ({
  getBoardConversationAccess: vi.fn(), listMyPartnerShares: vi.fn(async () => []),
  setBoardConversationAccess: vi.fn(), listSharedEngagements: vi.fn(async () => []),
  partnerShareLabel: () => "", shareEngagement: vi.fn(), unshareEngagement: vi.fn(),
}));

import { ShareDialog } from "@/components/canvas-lab/ShareDialog";

function openDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ShareDialog engagementId="e1" profileId="p1" />
    </QueryClientProvider> as ReactNode,
  );
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
}

function sendButton() {
  return within(screen.getByRole("group", { name: "Invite by email" })).getByRole("button");
}

const YOU = { id: "you", display_name: "Liam", access: "work", isYou: true, email: "liam@co.com" };

beforeEach(() => {
  vi.clearAllMocks();
  m.roster = [];
});
afterEach(cleanup);

describe("SHARE-4b corrections", () => {
  it("resolves typed text that narrows the list to one person, without clicking a row", async () => {
    m.roster = [YOU, { id: "ana", display_name: "Ana Ruiz", access: null, isYou: false, email: "ana@co.com" }];
    openDialog();
    const box = await screen.findByRole("combobox");
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(box, { target: { value: "ana" } });
    expect(sendButton().textContent).toBe("Add Ana Ruiz as Viewer");
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(1));
    expect(m.setAccess.mock.calls[0]![0]).toMatchObject({ data: { person_id: "ana", access: "review" } });
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("does not resolve the roster person on screen when the box is empty", async () => {
    m.roster = [YOU, { id: "ana", display_name: "Ana Ruiz", access: null, isYou: false, email: "ana@co.com" }];
    openDialog();
    const box = await screen.findByRole("combobox");
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    expect(sendButton().textContent).toBe("Send");
    fireEvent.click(sendButton());
    expect(m.setAccess).not.toHaveBeenCalled();
    expect(m.invite).not.toHaveBeenCalled();
    const alert = await screen.findByRole("alert");
    console.log("ALERT_HTML:", alert.outerHTML.slice(0, 200));
    expect(await screen.findByText("Pick someone from the list or enter an email address first.")).toBeTruthy();
  });

  it("resolves nothing when the typed text still leaves two people on screen", async () => {
    m.roster = [
      YOU,
      { id: "ana", display_name: "Ana Ruiz", access: null, isYou: false, email: "ana@co.com" },
      { id: "anders", display_name: "Anders Kai", access: null, isYou: false, email: "anders@co.com" },
    ];
    openDialog();
    const box = await screen.findByRole("combobox");
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(box, { target: { value: "an" } });
    expect(sendButton().textContent).toBe("Send");
    fireEvent.click(sendButton());
    expect(m.setAccess).not.toHaveBeenCalled();
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("still prefers an exact match over two people left on screen", async () => {
    m.roster = [
      YOU,
      { id: "ana", display_name: "Ana", access: null, isYou: false, email: "ana2@co.com" },
      { id: "ruiz", display_name: "Ana Ruiz", access: null, isYou: false, email: "ana@co.com" },
    ];
    openDialog();
    const box = await screen.findByRole("combobox");
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(box, { target: { value: "ana" } });
    expect(sendButton().textContent).toBe("Add Ana as Viewer");
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(1));
    expect(m.setAccess.mock.calls[0]![0]).toMatchObject({ data: { person_id: "ana" } });
  });

  it("shows the in flight label on the single Send button", async () => {
    m.roster = [YOU, { id: "ana", display_name: "Ana Ruiz", access: null, isYou: false, email: "ana@co.com" }];
    m.setAccess.mockImplementationOnce(() => new Promise(() => {}));
    openDialog();
    const box = await screen.findByRole("combobox");
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(box, { target: { value: "ana" } });
    expect(sendButton().textContent).toBe("Add Ana Ruiz as Viewer");
    fireEvent.click(sendButton());
    await waitFor(() => expect(sendButton().textContent).toBe("Sending"));
  });
});

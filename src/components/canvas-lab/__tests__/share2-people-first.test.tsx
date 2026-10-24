// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  setAccess: vi.fn(async (_input: unknown) => ({ status: "done", result: "granted" })),
  setConversations: vi.fn(async (_input: unknown) => ({ status: "done", result: "changed" })),
  invite: vi.fn(async (_input: unknown) => ({ ok: true, status: "sent", emailed: true })),
  listInvites: vi.fn(async () => [
    { id: "i1", email: "outside@else.com", level: "review", conversations: "full", status: "sent", createdAt: "2026-10-01T00:00:00Z" },
  ]),
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
  listEngagementPeopleFn: vi.fn(async () => ({
    canShare: true,
    people: [
      { id: "p1", display_name: "Liam", access: "work", isYou: true, email: "liam@co.com" },
      { id: "p2", display_name: "Ana Ruiz", access: null, isYou: false, email: "ana@co.com" },
      { id: "p3", display_name: "Ben Ode", access: "review", isYou: false, email: "ben@co.com", conversations: "full", addedAt: "2026-10-02T00:00:00Z" },
      { id: "p4", display_name: "Anabel Vega", access: null, isYou: false, email: "anabel@co.com" },
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
import { ACCESS_LEVEL_DISPLAY } from "@/lib/engagement-access-shared";

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
  const buttons = screen.getByRole("dialog").querySelectorAll<HTMLButtonElement>('[data-share-send="all"]');
  expect(buttons).toHaveLength(1);
  const button = buttons[0];
  if (!button) throw new Error("Missing combined Send button");
  return button;
}

async function readyCombobox() {
  const box = await screen.findByRole("combobox");
  await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
  return box;
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("SHARE-2 people-first Share dialog", () => {
  it("maps database levels to Viewer and Collaborator in one place", () => {
    expect(ACCESS_LEVEL_DISPLAY.review.label).toBe("Viewer");
    expect(ACCESS_LEVEL_DISPLAY.work.label).toBe("Collaborator");
  });

  it("picking a workspace member sets access and never sends an outside invite", async () => {
    openDialog();
    const box = await screen.findByRole("combobox");
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(box, { target: { value: "ana" } });
    fireEvent.click(await screen.findByRole("button", { name: /Ana Ruiz/ }));
    expect(m.setAccess).not.toHaveBeenCalled();
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(1));
    expect(m.setAccess.mock.calls[0]?.[0]).toMatchObject({
      data: { engagement_id: "e1", person_id: "p2", access: "review", conversations: "full" },
    });
    await waitFor(() =>
      expect(m.setConversations.mock.calls[0]?.[0]).toMatchObject({ data: { person_id: "p2", conversations: "full" } }),
    );
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("typing a workspace member's email offers no outside invite", async () => {
    openDialog();
    const box = await screen.findByRole("combobox");
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(box, { target: { value: "ana@co.com" } });
    expect(await screen.findByRole("button", { name: /Ana Ruiz/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /from outside/ })).toBeNull();
  });

  it("an outside email calls create_board_invite with full transcripts", async () => {
    openDialog();
    const box = await screen.findByRole("combobox");
    await waitFor(() => expect((box as HTMLInputElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Email addresses"), { target: { value: "new@else.com" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.invite).toHaveBeenCalledTimes(1));
    expect(m.invite.mock.calls[0]?.[0]).toEqual({
      data: { engagementId: "e1", email: "new@else.com", level: "review", conversations: "full" },
    });
    expect(m.setAccess).not.toHaveBeenCalled();
  });

  it("resolves a unique prefix at Send without clicking a suggestion", async () => {
    openDialog();
    const box = await readyCombobox();
    fireEvent.change(box, { target: { value: "Ana R" } });
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(1);
    expect(screen.queryByText(/^Chosen:/)).toBeNull();
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(1));
    expect(m.setAccess.mock.calls[0]?.[0]).toMatchObject({
      data: { engagement_id: "e1", person_id: "p2", access: "review", conversations: "full" },
    });
    await waitFor(() => expect(m.setConversations).toHaveBeenCalledTimes(1));
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("does not guess when a prefix leaves multiple suggestions", async () => {
    openDialog();
    const box = await readyCombobox();
    fireEvent.change(box, { target: { value: "Ana" } });
    expect(within(screen.getByRole("listbox")).getAllByRole("option")).toHaveLength(2);
    expect(sendButton().disabled).toBe(false);
    fireEvent.click(sendButton());
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent", "Pick someone from the list or enter an email address first.",
    );
    expect(m.setAccess).not.toHaveBeenCalled();
    expect(m.setConversations).not.toHaveBeenCalled();
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("Enter commits the top suggestion and clears the combobox", async () => {
    openDialog();
    const box = await readyCombobox();
    fireEvent.change(box, { target: { value: "Ana" } });
    const options = within(screen.getByRole("listbox")).getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]?.textContent).toContain("Ana Ruiz");
    expect(fireEvent.keyDown(box, { key: "Enter", code: "Enter" })).toBe(false);
    expect(screen.getByText("Chosen: Ana Ruiz")).toBeTruthy();
    expect((box as HTMLInputElement).value).toBe("");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(m.setAccess).not.toHaveBeenCalled();
    expect(m.invite).not.toHaveBeenCalled();
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(1));
    expect(m.setAccess.mock.calls[0]?.[0]).toMatchObject({ data: { person_id: "p2" } });
  });

  it("routes a roster email through access and conversations instead of an invite", async () => {
    openDialog();
    await readyCombobox();
    fireEvent.change(screen.getByLabelText("Email addresses"), { target: { value: "ana@co.com" } });
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(1));
    expect(m.setAccess.mock.calls[0]?.[0]).toMatchObject({
      data: { engagement_id: "e1", person_id: "p2", access: "review", conversations: "full" },
    });
    await waitFor(() => expect(m.setConversations).toHaveBeenCalledTimes(1));
    expect(m.setConversations.mock.calls[0]?.[0]).toMatchObject({ data: { person_id: "p2", conversations: "full" } });
    expect(m.invite).not.toHaveBeenCalled();
  });

  it("grants a picked person and invites an outside address in one Send", async () => {
    openDialog();
    const box = await readyCombobox();
    fireEvent.change(box, { target: { value: "Ana R" } });
    fireEvent.click(within(screen.getByRole("listbox")).getByRole("button", { name: /Ana Ruiz/ }));
    fireEvent.change(screen.getByLabelText("Email addresses"), { target: { value: "new@else.com" } });
    fireEvent.click(sendButton());
    await waitFor(() => {
      expect(m.setAccess).toHaveBeenCalledTimes(1);
      expect(m.setConversations).toHaveBeenCalledTimes(1);
      expect(m.invite).toHaveBeenCalledTimes(1);
    });
    expect(m.setAccess.mock.calls[0]?.[0]).toMatchObject({ data: { person_id: "p2", access: "review" } });
    expect(m.invite.mock.calls[0]?.[0]).toEqual({
      data: { engagementId: "e1", email: "new@else.com", level: "review", conversations: "full" },
    });
  });

  it("names the resolved person and the current access level on Send", async () => {
    openDialog();
    const box = await readyCombobox();
    fireEvent.change(box, { target: { value: "Ana R" } });
    expect(sendButton().textContent).toBe("Add Ana Ruiz as Viewer");
    fireEvent.click(within(screen.getByRole("group", { name: "New person level" })).getByRole("button", { name: "Collaborator" }));
    expect(sendButton().textContent).toBe("Add Ana Ruiz as Collaborator");
    fireEvent.click(sendButton());
    await waitFor(() => expect(m.setAccess).toHaveBeenCalledTimes(1));
    expect(m.setAccess.mock.calls[0]?.[0]).toMatchObject({ data: { person_id: "p2", access: "work" } });
  });

  it("the access list names every person and every pending invite", async () => {
    openDialog();
    const list = await screen.findByRole("list", { name: "Who has access" });
    await waitFor(() => expect(within(list).getByText("Ben Ode")).toBeTruthy());
    await waitFor(() => expect(within(list).getByText("outside@else.com")).toBeTruthy());
    expect(within(list).getByText("Pending")).toBeTruthy();
    expect(within(list).getByText("You")).toBeTruthy();
    for (const row of list.querySelectorAll("[data-share-row]")) {
      expect((row.textContent ?? "").trim().length).toBeGreaterThan(0);
    }
  });
});

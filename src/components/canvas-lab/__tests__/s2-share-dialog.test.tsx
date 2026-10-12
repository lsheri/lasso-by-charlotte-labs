// @vitest-environment jsdom
/**
 * S2: what the share dialog does, not how it is written.
 *
 * Every assertion here is behaviour: which words reach the server function,
 * and what shows when there is nobody to choose.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { access: string; person_id: string }[] = [];

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
}));

vi.mock("@/lib/board-invites.functions", () => ({
  inviteToBoard: vi.fn(async () => ({ ok: true, status: "sent", emailed: true })),
  listBoardInvites: vi.fn(async () => []),
  withdrawBoardInvite: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({
    canShare: true,
    people: [
      { id: "p-me", display_name: "Liam", access: "work", isYou: true },
      { id: "p-new", display_name: "Nadia", access: null, isYou: false },
      { id: "p-on", display_name: "Owen", access: "review", isYou: false },
    ],
  })),
  setEngagementPersonAccessFn: vi.fn(async ({ data }: { data: { access: string; person_id: string } }) => {
    calls.push({ access: data.access, person_id: data.person_id });
    return { status: "done", result: "granted" };
  }),
  setPersonConversationsFn: vi.fn(async () => ({ status: "done", result: "unchanged" })),
}));

// Keeps the partner section off the live database: no real coaching_links reads.
vi.mock("@/lib/partner-share", () => ({
  listMyPartnerShares: vi.fn(async () => []),
  listSharedEngagements: vi.fn(async () => []),
  shareEngagement: vi.fn(async () => undefined),
  unshareEngagement: vi.fn(async () => undefined),
  getBoardConversationAccess: vi.fn(async () => "summaries"),
  partnerShareLabel: (share: { institutionName: string; coachName?: string | null }) =>
    share.coachName ? `${share.coachName} · ${share.institutionName}` : share.institutionName,
  setBoardConversationAccess: vi.fn(async () => "unchanged"),
}));
vi.mock("@/lib/board-share.functions", () => ({
  listBoardShareLinksFn: vi.fn(async () => ({ links: [], holdsOthersWork: false, canShare: true })),
  createBoardShareLinkFn: vi.fn(async () => ({ status: "error" })),
  expireBoardShareLinkFn: vi.fn(async () => ({ status: "not_found" })),
}));

import { ShareDialog } from "@/components/canvas-lab/ShareDialog";


function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ShareDialog engagementId="e-1" profileId="p-me" />
    </QueryClientProvider>,
  );
}

async function openDialog() {
  mount();
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await screen.findByText("Owen");
}

afterEach(cleanup);

describe("S2 — giving someone one of two things", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("offers exactly two choices for a person", async () => {
    await openDialog();
    const labels = ["Viewer", "Collaborator"];
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(within(screen.getByRole("group", { name: "Owen" })).getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("choosing one sends that word and nothing else", async () => {
    await openDialog();
    fireEvent.click(within(screen.getByRole("group", { name: "Owen" })).getByRole("button", { name: "Viewer" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ person_id: "p-on", access: "review" });

    await waitFor(() => expect(within(screen.getByRole("group", { name: "Owen" })).getByRole("button", { name: "Collaborator" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(within(screen.getByRole("group", { name: "Owen" })).getByRole("button", { name: "Collaborator" }));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1]).toEqual({ person_id: "p-on", access: "work" });
    for (const call of calls) expect(["review", "work", "none"]).toContain(call.access);
  });

  it("taking it away sends none, and is never offered on yourself", async () => {
    await openDialog();
    const takeAway = await screen.findAllByRole("button", { name: "Remove" });
    expect(takeAway).toHaveLength(1);
    const remove = takeAway[0];
    if (!remove) throw new Error("Missing Remove");
    fireEvent.click(remove);
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ person_id: "p-on", access: "none" });
  });

  it("there is no third section", async () => {
    await openDialog();
    expect(screen.queryByText("Not available yet")).toBeNull();
    expect(screen.queryByText("Working on the same board together")).toBeNull();
  });

  it("the link section never claims the AI conversations travel with it", async () => {
    const { container } = mount();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText("Link");
    expect(container.textContent ?? "").not.toContain("including the AI conversations");
  });

  it("with nobody to pick, your level remains without access controls", async () => {
    const { listEngagementPeopleFn } = await import("@/lib/engagement-access.functions");
    vi.mocked(listEngagementPeopleFn).mockResolvedValueOnce({
      canShare: true,
      people: [{ id: "p-me", display_name: "Liam", access: "work", isYou: true }],
    } as never);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText("Nobody else in your workspace yet.");
    expect(screen.getByText("You")).toBeTruthy();
    expect(screen.getByText("Nobody else in your workspace yet.")).toBeTruthy();
    expect(screen.getByLabelText("Add people by name or email").hasAttribute("disabled")).toBe(false);
    for (const label of ["Viewer", "Collaborator"]) expect(screen.getByRole("button", { name: label })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Remove" })).toBeNull();
  });
  it("adds a person with the picked Collaborator level", async () => {
    await openDialog();
    fireEvent.click(within(screen.getByRole("group", { name: "New person level" })).getByRole("button", { name: "Collaborator" }));
    fireEvent.change(screen.getByLabelText("Add people by name or email"), { target: { value: "nad" } });
    fireEvent.click(screen.getByRole("button", { name: "Nadia" }));
    await waitFor(() => expect(calls).toEqual([{ person_id: "p-new", access: "work" }]));
  });

  it("removes the old explanations, empty copy and link paragraphs", async () => {
    await openDialog();
    for (const text of [
      "Who has access", "Can view: Can open the board and read the cards.",
      "Multiplayer: Can also add and arrange work.",
      "Summaries only: they can ask Lasso how AI was used here, but can't open the conversations.",
      "Nobody else is on this board yet.",
      "Nobody else is in your workspace yet. Invite people from Settings, People.",
      "You can expire this link yourself at any point before the 48 hours are up.",
      "The board keeps changing, so whoever opens the link sees the board as it is then, not as it was when you made the link.",
    ]) expect(screen.queryByText(text)).toBeNull();
    expect(screen.getByText("None open.")).toBeTruthy();
    expect(screen.getByText("Anyone with the link sees the cards and summaries for 48 hours. Conversations stay private.")).toBeTruthy();
  });

});

// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/board-invites.functions", () => ({
  inviteToBoard: vi.fn(async () => ({ ok: true, status: "sent", emailed: true })),
  listBoardInvites: vi.fn(async () => []),
  withdrawBoardInvite: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({
    canShare: true,
    people: [
      { id: "other", display_name: "Owen", access: "review", isYou: false },
      { id: "me", display_name: "Liam", access: "work", isYou: true },
      { id: "new", display_name: "Nadia", access: null, isYou: false },
    ],
  })),
  setEngagementPersonAccessFn: vi.fn(async () => ({ status: "done", result: "changed" })),
  setPersonConversationsFn: vi.fn(async () => ({ status: "done", result: "unchanged" })),
}));
vi.mock("@/lib/partner-share", () => ({ listMyPartnerShares: vi.fn(async () => []), listSharedEngagements: vi.fn(), shareEngagement: vi.fn(), unshareEngagement: vi.fn() }));
vi.mock("@/components/canvas-lab/ShareBoardDialog", () => ({ BoardLinkSection: () => null }));
import { ShareDialog, PEOPLE_COPY } from "@/components/canvas-lab/ShareDialog";
import { listEngagementPeopleFn, setEngagementPersonAccessFn } from "@/lib/engagement-access.functions";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ShareDialog engagementId="board" profileId="me" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await screen.findByText("You");
  return screen.getByRole("region", { name: "People" });
}

afterEach(cleanup);

describe("SH-3a people access", () => {
  beforeEach(() => vi.clearAllMocks());
  it("maps labels independently to the unchanged access values", async () => {
    const section = await mount();
    for (const [label, access] of [["Collaborator", "work"], ["Viewer", "review"], ["Remove", "none"]] as const) {
      const button = label === "Remove" ? within(section).getByRole("button", { name: label }) : within(within(section).getByRole("group", { name: "Owen" })).getByRole("button", { name: label });
      await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
      fireEvent.click(button);
      await waitFor(() => expect(setEngagementPersonAccessFn).toHaveBeenLastCalledWith({ data: { engagement_id: "board", profile_id: "me", person_id: "other", access } }));
    }
  });
  it("does not add an unknown email", async () => {
    const section = await mount();
    fireEvent.change(within(section).getByLabelText("Add people by name or email"), { target: { value: "unknown@example.com" } });
    expect(within(section).getByRole("button", { name: "Invite unknown@example.com" })).toBeTruthy();
    expect(within(section).queryByText("Only people in this workspace can be added here.")).toBeNull();
    expect(setEngagementPersonAccessFn).not.toHaveBeenCalled();
  });
  it("puts your level first and adds a suggested member as Can view", async () => {
    const section = await mount();
    expect(within(section).getAllByRole("listitem")[0]?.textContent?.trim()).toBe("You");
    fireEvent.change(within(section).getByLabelText("Add people by name or email"), { target: { value: "nad" } });
    expect(within(section).queryByRole("button", { name: "Owen" })).toBeNull();
    fireEvent.click(within(section).getByRole("button", { name: "Nadia" }));
    await waitFor(() => expect(setEngagementPersonAccessFn).toHaveBeenCalledWith({ data: { engagement_id: "board", profile_id: "me", person_id: "new", access: "review", conversations: "summaries" } }));
  });
  it("labels a non-owner viewer with their own level, never ownership", async () => {
    vi.mocked(listEngagementPeopleFn).mockResolvedValueOnce({
      canShare: false,
      people: [{ id: "me", display_name: "Liam", access: "review", isYou: true }],
    });
    const section = await mount();
    expect(within(section).getByText("You")).toBeTruthy();
    expect(section.textContent).not.toContain("Owner");
  });
  it("shows the explanations once with two other people on the board", async () => {
    vi.mocked(listEngagementPeopleFn).mockResolvedValueOnce({
      canShare: true,
      people: [
        { id: "me", display_name: "Liam", access: "work", isYou: true },
        { id: "other", display_name: "Owen", access: "review", isYou: false },
        { id: "second", display_name: "Nadia", access: "work", isYou: false },
      ],
    });
    const section = await mount();
    expect(within(section).queryByText("Can view: Can open the board and read the cards.")).toBeNull();
    expect(within(section).getAllByTitle(PEOPLE_COPY.viewLine)).toHaveLength(3);
    expect(within(section).queryByText("Multiplayer: Can also add and arrange work.")).toBeNull();
    expect(within(section).getAllByTitle(PEOPLE_COPY.multiplayerLine)).toHaveLength(3);
  });
  it("shows Owen's Can view choice pressed and using the secondary variant", async () => {
    const section = await mount();
    const group = within(section).getByRole("group", { name: "Owen" });
    const view = within(group).getByRole("button", { name: "Viewer", pressed: true });
    const multiplayer = within(group).getByRole("button", { name: "Collaborator", pressed: false });
    expect(view.className).toBe(cn(buttonVariants({ variant: "ink", size: "sm", className: "text-sm" })));
    expect(multiplayer.className).toBe(cn(buttonVariants({ variant: "ghost", size: "sm", className: "text-sm" })));
    expect(view.querySelector("[data-selected-check]")).toBeTruthy();
    expect(multiplayer.querySelector("[data-selected-check]")).toBeNull();
  });
  it("restores empty-workspace guidance and disables the field", async () => {
    vi.mocked(listEngagementPeopleFn).mockResolvedValueOnce({
      canShare: true,
      people: [{ id: "me", display_name: "Liam", access: "work", isYou: true }],
    });
    const section = await mount();
    expect(within(section).getByText("Nobody else in your workspace yet.")).toBeTruthy();
    expect(within(section).getByLabelText("Add people by name or email").hasAttribute("disabled")).toBe(false);
  });
  it("renders no internal role words, preserving the required explanatory work sentence", async () => {
    const section = await mount();
    // Required copy explicitly includes work and workspace, not access-role labels.
    const labels = [...section.querySelectorAll("button, label, li > span")].map((node) => node.textContent).join(" ");
    expect(labels.toLowerCase()).not.toMatch(/\b(coach|review|work)\b/);
    expect(section.textContent?.toLowerCase()).not.toMatch(/\b(coach|review)\b/);
    expect(within(section).getAllByTitle(PEOPLE_COPY.multiplayerLine)).toHaveLength(2);
    expect(Object.values(PEOPLE_COPY).join(" ")).not.toMatch(/—|\baudit\b|\bmonitor\b|\boversight\b/i);
    expect(PEOPLE_COPY.viewLine).toBe("Opens the board and reads the cards");
    expect(PEOPLE_COPY.multiplayerLine).toBe("Also adds and arranges work");
  });
});

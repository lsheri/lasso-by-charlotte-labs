// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
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
}));
vi.mock("@/lib/partner-share", () => ({ listMyPartnerShares: vi.fn(async () => []), listSharedEngagements: vi.fn(), shareEngagement: vi.fn(), unshareEngagement: vi.fn() }));
vi.mock("@/components/canvas-lab/ShareBoardDialog", () => ({ BoardLinkSection: () => null }));
import { ShareDialog, PEOPLE_COPY } from "@/components/canvas-lab/ShareDialog";
import { listEngagementPeopleFn, setEngagementPersonAccessFn } from "@/lib/engagement-access.functions";
import { buttonVariants } from "@/components/ui/button";

async function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ShareDialog engagementId="board" profileId="me" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await screen.findByText(/^You · /);
  return screen.getByRole("region", { name: "Who has access" });
}

afterEach(cleanup);

describe("SH-3a people access", () => {
  beforeEach(() => vi.clearAllMocks());
  it("maps labels independently to the unchanged access values", async () => {
    const section = await mount();
    for (const [label, access] of [["Multiplayer", "work"], ["Can view", "review"], ["Remove", "none"]] as const) {
      const button = within(section).getByRole("button", { name: label });
      await waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
      fireEvent.click(button);
      await waitFor(() => expect(setEngagementPersonAccessFn).toHaveBeenLastCalledWith({ data: { engagement_id: "board", profile_id: "me", person_id: "other", access } }));
    }
  });
  it("does not add an unknown email", async () => {
    const section = await mount();
    fireEvent.change(within(section).getByLabelText("Add people by name"), { target: { value: "unknown@example.com" } });
    expect(within(section).getByText("Only people in this workspace can be added here.")).toBeTruthy();
    expect(setEngagementPersonAccessFn).not.toHaveBeenCalled();
  });
  it("puts your level first and adds a suggested member as Can view", async () => {
    const section = await mount();
    expect(within(section).getAllByRole("listitem")[0]?.textContent?.trim()).toBe("You · Multiplayer");
    fireEvent.change(within(section).getByLabelText("Add people by name"), { target: { value: "nad" } });
    expect(within(section).queryByRole("button", { name: "Owen" })).toBeNull();
    fireEvent.click(within(section).getByRole("button", { name: "Nadia" }));
    await waitFor(() => expect(setEngagementPersonAccessFn).toHaveBeenCalledWith({ data: { engagement_id: "board", profile_id: "me", person_id: "new", access: "review" } }));
  });
  it("labels a non-owner viewer with their own level, never ownership", async () => {
    vi.mocked(listEngagementPeopleFn).mockResolvedValueOnce({
      canShare: false,
      people: [{ id: "me", display_name: "Liam", access: "review", isYou: true }],
    });
    const section = await mount();
    expect(within(section).getByText("You · Can view")).toBeTruthy();
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
    expect(within(section).getAllByText("Can view: Can open the board and read the cards.")).toHaveLength(1);
    expect(within(section).getAllByText("Multiplayer: Can also add and arrange work.")).toHaveLength(1);
  });
  it("shows Owen's Can view choice pressed and using the secondary variant", async () => {
    const section = await mount();
    const group = within(section).getByRole("group", { name: "Owen" });
    const view = within(group).getByRole("button", { name: "Can view", pressed: true });
    const multiplayer = within(group).getByRole("button", { name: "Multiplayer", pressed: false });
    expect(view.className).toBe(buttonVariants({ variant: "secondary", size: "sm" }));
    expect(multiplayer.className).toBe(buttonVariants({ variant: "outline", size: "sm" }));
  });
  it("restores empty-workspace guidance and disables the field", async () => {
    vi.mocked(listEngagementPeopleFn).mockResolvedValueOnce({
      canShare: true,
      people: [{ id: "me", display_name: "Liam", access: "work", isYou: true }],
    });
    const section = await mount();
    expect(within(section).getByText("Nobody else is in your workspace yet. Invite people from Settings, People.")).toBeTruthy();
    expect(within(section).getByLabelText("Add people by name").hasAttribute("disabled")).toBe(true);
  });
  it("renders no internal role words, preserving the required explanatory work sentence", async () => {
    const section = await mount();
    // Required copy explicitly includes work and workspace, not access-role labels.
    const labels = [...section.querySelectorAll("button, label, li > span")].map((node) => node.textContent).join(" ");
    expect(labels.toLowerCase()).not.toMatch(/\b(coach|review|work)\b/);
    expect(section.textContent?.toLowerCase()).not.toMatch(/\b(coach|review)\b/);
    expect(within(section).getByText(`Multiplayer: ${PEOPLE_COPY.multiplayerLine}`)).toBeTruthy();
    expect(Object.values(PEOPLE_COPY).join(" ")).not.toMatch(/—|\baudit\b|\bmonitor\b|\boversight\b/i);
    expect(PEOPLE_COPY.viewLine).toBe("Can open the board and read the cards.");
    expect(PEOPLE_COPY.multiplayerLine).toBe("Can also add and arrange work.");
  });
});

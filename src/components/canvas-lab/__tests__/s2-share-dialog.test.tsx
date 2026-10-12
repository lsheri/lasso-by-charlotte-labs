// @vitest-environment jsdom
/**
 * S2: what the share dialog does, not how it is written.
 *
 * Every assertion here is behaviour: which words reach the server function,
 * and what shows when there is nobody to choose.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { access: string; person_id: string }[] = [];

vi.mock("@tanstack/react-start", () => ({
  useServerFn: (fn: unknown) => fn,
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
    const labels = ["Can view", "Multiplayer"];
    expect(labels).toHaveLength(2);
    for (const label of labels) {
      expect(screen.getByRole("button", { name: label })).toBeTruthy();
    }
  });

  it("choosing one sends that word and nothing else", async () => {
    await openDialog();
    fireEvent.click(screen.getByRole("button", { name: "Can view" }));
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]).toEqual({ person_id: "p-on", access: "review" });

    await waitFor(() => expect(screen.getByRole("button", { name: "Multiplayer" }).hasAttribute("disabled")).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Multiplayer" }));
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

  it("with nobody to pick, your level remains without access controls", async () => {
    const { listEngagementPeopleFn } = await import("@/lib/engagement-access.functions");
    vi.mocked(listEngagementPeopleFn).mockResolvedValueOnce({
      canShare: true,
      people: [{ id: "p-me", display_name: "Liam", access: "work", isYou: true }],
    } as never);
    mount();
    fireEvent.click(screen.getByRole("button", { name: "Share" }));
    await screen.findByText("Nobody else is on this board yet.");
    expect(screen.getByText("You · Multiplayer")).toBeTruthy();
    expect(screen.getByText("Nobody else is in your workspace yet. Invite people from Settings, People.")).toBeTruthy();
    expect(screen.getByLabelText("Add people by name").hasAttribute("disabled")).toBe(true);
    for (const label of ["Can view", "Multiplayer", "Remove"]) expect(screen.queryByRole("button", { name: label })).toBeNull();
  });
});

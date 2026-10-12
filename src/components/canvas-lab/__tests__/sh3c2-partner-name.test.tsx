// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const shares = vi.fn();

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/board-invites.functions", () => ({
  inviteToBoard: vi.fn(async () => ({ ok: true, status: "sent", emailed: true })),
  listBoardInvites: vi.fn(async () => []),
  withdrawBoardInvite: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({ canShare: true, people: [] })),
  setEngagementPersonAccessFn: vi.fn(),
  setPersonConversationsFn: vi.fn(),
}));
vi.mock("@/lib/board-share.functions", () => ({
  listBoardShareLinksFn: vi.fn(async () => ({ links: [], holdsOthersWork: false, canShare: true })),
  createBoardShareLinkFn: vi.fn(),
  expireBoardShareLinkFn: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/partner-share", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/partner-share")>();
  return {
    ...actual,
    listMyPartnerShares: () => shares(),
    listSharedEngagements: vi.fn(async () => ["e-1"]),
    getBoardConversationAccess: vi.fn(async () => "summaries"),
  };
});

import { ShareDialog } from "@/components/canvas-lab/ShareDialog";

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ShareDialog engagementId="e-1" profileId="p-me" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
}

afterEach(cleanup);

describe("SH-3c-2 partner rows name the person", () => {
  it("reads Name · Institution when a name is present", async () => {
    shares.mockResolvedValue([
      { linkId: "l-1", institutionId: "i-1", institutionName: "Ceiba·Uni", bound: true, coachName: "Gaby Ruz" },
    ]);
    mount();
    expect(await screen.findByText("Gaby Ruz · Ceiba·Uni")).toBeTruthy();
    expect(await screen.findByRole("group", { name: "Gaby Ruz · Ceiba·Uni conversations" })).toBeTruthy();
    expect(document.body.textContent?.toLowerCase()).not.toContain("coach");
  });

  it("reads the institution alone when no name is present", async () => {
    shares.mockResolvedValue([
      { linkId: "l-1", institutionId: "i-1", institutionName: "Ceiba·Uni", bound: true, coachName: null },
    ]);
    mount();
    expect(await screen.findByText("Ceiba·Uni")).toBeTruthy();
    expect(screen.queryByText(/ · Ceiba·Uni/)).toBeNull();
  });
});

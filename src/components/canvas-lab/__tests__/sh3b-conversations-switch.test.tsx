// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const convoCalls: { person_id: string; conversations: string }[] = [];
const linkCalls: unknown[][] = [];

vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));

vi.mock("@/lib/engagement-access.functions", () => ({
  listEngagementPeopleFn: vi.fn(async () => ({
    canShare: true,
    people: [
      { id: "p-me", display_name: "Liam", access: "work", isYou: true, conversations: "full" },
      { id: "p-on", display_name: "Owen", access: "review", isYou: false, conversations: "summaries" },
      { id: "p-fu", display_name: "Fay", access: "work", isYou: false, conversations: "full" },
    ],
  })),
  setEngagementPersonAccessFn: vi.fn(async () => ({ status: "done", result: "changed" })),
  setPersonConversationsFn: vi.fn(async ({ data }: { data: { person_id: string; conversations: string } }) => {
    convoCalls.push({ person_id: data.person_id, conversations: data.conversations });
    return { status: "done", result: "changed" };
  }),
}));

vi.mock("@/lib/board-share.functions", () => ({
  listBoardShareLinksFn: vi.fn(async () => ({ links: [], holdsOthersWork: false, canShare: true })),
  createBoardShareLinkFn: vi.fn(async () => ({ status: "error" })),
  expireBoardShareLinkFn: vi.fn(async () => ({ status: "not_found" })),
}));

vi.mock("@/lib/partner-share", () => ({
  listMyPartnerShares: vi.fn(async () => [
    { linkId: "link-1", institutionId: "i-1", institutionName: "Harbor School", bound: true },
  ]),
  listSharedEngagements: vi.fn(async () => ["e-1"]),
  shareEngagement: vi.fn(async () => undefined),
  unshareEngagement: vi.fn(async () => undefined),
  getBoardConversationAccess: vi.fn(async () => "full"),
  setBoardConversationAccess: vi.fn(async (...args: unknown[]) => {
    linkCalls.push(args);
  }),
}));

import { ShareDialog } from "@/components/canvas-lab/ShareDialog";
import { SUMMARY_ONLY_LINE, summaryOnlyLine } from "@/components/peek/RenderedContent";

async function openDialog() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <ShareDialog engagementId="e-1" profileId="p-me" />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await screen.findByText("Owen");
}

function group(name: string) {
  return screen.getByRole("group", { name: `${name} conversations` });
}
function btn(name: string, label: string) {
  const found = Array.from(group(name).querySelectorAll("button")).find((b) => b.textContent === label);
  if (!found) throw new Error(`missing ${label}`);
  return found;
}

afterEach(cleanup);
beforeEach(() => {
  convoCalls.length = 0;
  linkCalls.length = 0;
});

describe("SH-3b conversations switch", () => {
  it("sends full for Full conversations and summaries for Summaries only", async () => {
    await openDialog();
    fireEvent.click(btn("Owen", "Full conversations"));
    await waitFor(() => expect(convoCalls).toHaveLength(1));
    expect(convoCalls[0]).toEqual({ person_id: "p-on", conversations: "full" });
    await waitFor(() => expect(btn("Fay", "Summaries only").disabled).toBe(false));
    fireEvent.click(btn("Fay", "Summaries only"));
    await waitFor(() => expect(convoCalls).toHaveLength(2));
    expect(convoCalls[1]).toEqual({ person_id: "p-fu", conversations: "summaries" });
  });

  it("your own row has no switch, and the line sits under the heading", async () => {
    await openDialog();
    expect(screen.queryByRole("group", { name: "Liam conversations" })).toBeNull();
    expect(
      screen.getByText("Summaries only: they can ask Lasso how AI was used here, but can't open the conversations."),
    ).toBeTruthy();
  });

  it("pressed state follows the data", async () => {
    await openDialog();
    expect(btn("Owen", "Summaries only").getAttribute("aria-pressed")).toBe("true");
    expect(btn("Owen", "Full conversations").getAttribute("aria-pressed")).toBe("false");
    expect(btn("Fay", "Full conversations").getAttribute("aria-pressed")).toBe("true");
    await waitFor(() => expect(btn("Harbor School", "Full conversations").getAttribute("aria-pressed")).toBe("true"));
  });

  it("the partner switch writes with the link and board ids", async () => {
    await openDialog();
    await waitFor(() => expect(btn("Harbor School", "Summaries only").disabled).toBe(false));
    fireEvent.click(btn("Harbor School", "Summaries only"));
    await waitFor(() => expect(linkCalls).toHaveLength(1));
    expect(linkCalls[0]).toEqual(["link-1", "e-1", "summaries"]);
  });
});

describe("SH-3b reader empty state", () => {
  it("a non-owner with empty_thread sees the summary sentence; the owner does not", () => {
    expect(summaryOnlyLine("empty_thread", { owner_id: "p-owner" }, "p-viewer")).toBe(SUMMARY_ONLY_LINE);
    expect(summaryOnlyLine("empty_thread", { owner_id: "p-owner" }, "p-owner")).toBeNull();
    expect(summaryOnlyLine("decrypt_failed", { owner_id: "p-owner" }, "p-viewer")).toBeNull();
  });
});

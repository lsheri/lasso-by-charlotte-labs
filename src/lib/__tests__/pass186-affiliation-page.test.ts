import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AffiliationContent } from "@/pages/AffiliationPage";
import { unshareEngagement } from "@/lib/partner-share";

vi.mock("@/lib/partner-share", () => ({
  listMyPartnerShares: vi.fn(),
  listSharedEngagements: vi.fn(),
  unshareEngagement: vi.fn(),
}));

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("pass 186: the student's transparency page", () => {
  const page = read("src/pages/AffiliationPage.tsx");

  it("carries the exact lines", () => {
    expect(page).toContain("Counts, never content.");
    expect(page).toContain("None of this reaches ${institutionName}.");
    expect(page).toContain("your record is yours, and it leaves with you");
  });

  // Each word asserted on its own so a failure names which one leaked.
  it.each(["monitor", "track", "score", "surveillance", "compliance", "telemetry", "analytics"])(
    "never uses the word %s",
    (word: string) => {
      expect(page.toLowerCase()).not.toContain(word);
    },
  );

  it("renders the empty share state without a share action", () => {
    expect(page).toContain("Nothing has been shared");
    expect(page).not.toMatch(/<Button[^>]*>\s*Share/);
  });

  it("the nav gains the item only through the hook", () => {
    const nav = read("src/components/layout/SidebarNav.tsx");
    expect(nav).toContain("useAffiliation");
    expect(nav).toContain("`Your ${institution.name} link`");
  });

  it("leads with the nothing-shared fact before the counts panel", () => {
    render(
      createElement(AffiliationContent, {
        institutionName: "Artemis Connection",
        projectCount: 0,
        toolCount: 0,
        keptCount: 0,
        sharedCount: 0,
      }),
    );
    const empty = screen.getByText("Nothing has been shared with Artemis Connection.");
    const counts = screen.getByTestId("affiliation-counts");
    expect(empty.compareDocumentPosition(counts) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("registers the event, dims only", () => {
    expect(read("src/lib/telemetry-shared.ts")).toContain('| "affiliation.disclosure_read"');
    const fns = read("src/lib/affiliation.functions.ts");
    expect(fns).toContain("affiliation.disclosure_read");
    expect(fns).not.toContain("payload");
  });

  it("reads the real share count and keeps unknown boards visible", () => {
    expect(page).not.toContain("sharedCount={0}");
    expect(page).toContain("sharedCount={sharedBoards.length}");
    expect(page).toContain("listMyPartnerShares(profile.id)");
    expect(page).toContain("listSharedEngagements(share.linkId)");
    expect(page).toContain('?? "A board you are no longer on"');
  });

  it("shows each shared board and keeps a failed stop visible and retryable", async () => {
    vi.mocked(unshareEngagement).mockRejectedValueOnce(new Error("refused"));
    const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
    render(createElement(QueryClientProvider, { client }, createElement(AffiliationContent, {
      institutionName: "Artemis Connection", projectCount: 1, toolCount: 0, keptCount: 0, sharedCount: 2,
      sharedBoards: [
        { linkId: "link-1", engagementId: "board-1", title: "Quarterly margin review" },
        { linkId: "link-1", engagementId: "board-2", title: "A board you are no longer on" },
      ],
    })));
    expect(screen.getByText("Artemis Connection can open these boards.")).toBeTruthy();
    expect(screen.getByText("Quarterly margin review")).toBeTruthy();
    expect(screen.getByText("A board you are no longer on")).toBeTruthy();
    expect(screen.queryByText("Nothing has been shared with Artemis Connection.")).toBeNull();
    expect(screen.queryByText("None of this leaves your account.")).toBeNull();
    expect(screen.getByText("They see the work you have placed on each one, and nothing you have not placed.")).toBeTruthy();
    const stop = screen.getAllByRole("button", { name: "Stop sharing" })[0];
    if (!stop) throw new Error("Stop sharing control missing");
    fireEvent.click(stop);
    await waitFor(() => expect(screen.getByRole("alert").textContent).toBe("That did not change. Try again."));
    expect(unshareEngagement).toHaveBeenCalledWith("link-1", "board-1");
    expect(stop.hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("Quarterly margin review")).toBeTruthy();
    client.clear();
  });

  it.each([{ sharingPending: true }, { sharingFailed: true }])("does not claim nothing is shared before a successful read: %j", (state) => {
    render(createElement(AffiliationContent, {
      institutionName: "Artemis Connection", projectCount: 0, toolCount: 0, keptCount: 0, sharedCount: 0, ...state,
    }));
    expect(screen.queryByText("Nothing has been shared with Artemis Connection.")).toBeNull();
  });
});

afterEach(cleanup);

// @vitest-environment jsdom
// Liam, 15 Nov: boards can be shared with the firm before they are done, as live in-progress views, and sharing
// never takes a board out of its owner's menu, which now says it is shared.
import { readFileSync } from "node:fs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({ data: { id: "p1", org_id: "o1" } }) }));
vi.mock("@/lib/partner-share", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMyPartnerShares: async () => [
    { linkId: "l1", institutionId: "i1", institutionName: "Acme Partners", bound: true },
    { linkId: "l2", institutionId: "i2", institutionName: "North School", bound: true },
  ],
  listSharedEngagements: async (linkId: string) => (linkId === "l1" ? ["b1", "b2"] : ["b2"]),
}));

import { useBoardsSharedUp } from "@/hooks/use-boards-shared-up";
import { SHARE_UP_COPY } from "@/lib/share-up-copy";

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>
);

describe("sharing a board up keeps it yours and says so", () => {
  it("maps each of the owner's boards to every institution it is shared with", async () => {
    const { result } = renderHook(() => useBoardsSharedUp(), { wrapper });
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get("b1")).toEqual(["Acme Partners"]);
    expect(result.current.get("b2")).toEqual(["Acme Partners", "North School"]);
    expect(SHARE_UP_COPY.ownerMark(["Acme Partners", "North School"])).toBe("Shared live with Acme Partners, North School");
  });

  it("tells the owner it stays theirs and in their menu, and the reader that it is live and in progress", () => {
    expect(SHARE_UP_COPY.ownerLine).toMatch(/stays yours and stays in your menu/);
    expect(SHARE_UP_COPY.ownerLine).toMatch(/Ship to firm/);
    expect(SHARE_UP_COPY.readerLine).toMatch(/in progress/);
    for (const line of Object.values(SHARE_UP_COPY)) if (typeof line === "string") expect(line).not.toMatch(/—/);
    expect(readFileSync("src/components/canvas-lab/ShareDialog.tsx", "utf8")).toContain("{SHARE_UP_COPY.ownerLine}");
    expect(readFileSync("src/pages/PartnerSharedBoardPage.tsx", "utf8")).toContain("{SHARE_UP_COPY.readerLine}");
    expect(readFileSync("src/components/layout/FromYourPeople.tsx", "utf8")).toContain("{SHARE_UP_COPY.readerTag}");
  });

  it("marks the owner's sidebar row and refreshes it when sharing changes", () => {
    const nav = readFileSync("src/components/layout/SidebarNav.tsx", "utf8");
    expect(nav).toContain("useBoardsSharedUp().get(engagement.id)");
    expect(nav).toContain('<GraphiteIcon name="firm" size={14} animate={false} />');
    expect(readFileSync("src/components/canvas-lab/ShareDialog.tsx", "utf8")).toContain('queryKey: ["boards-shared-up"]');
    expect(readFileSync("src/pages/AffiliationPage.tsx", "utf8")).toContain('queryKey: ["boards-shared-up"]');
  });
});

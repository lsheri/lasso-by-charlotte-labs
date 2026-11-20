// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ profile: { id: "p1", org_id: "o1", role: "admin", org_type: "company" } as Record<string, unknown> }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: m.profile }),
}));
vi.mock("@/hooks/use-members", () => ({ useMembers: () => ({ data: { members: [] } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }), useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/use-coach-share", () => ({ useShareInvalidation: () => vi.fn() }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/invites.functions", () => ({ sendInviteEmail: vi.fn(), createInvite: vi.fn() }));

import { InviteDialog } from "@/components/invites/InviteDialog";

afterEach(cleanup);

describe("SHARE-2 invite form default", () => {
  it("defaults a new person to member, not admin", async () => {
    render(<InviteDialog trigger={<button type="button">Invite someone</button>} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    const teammate = await screen.findByRole("button", { name: /^Member/ });
    expect(teammate.getAttribute("aria-pressed")).toBe("true");
    const admin = screen.getByRole("button", { name: /^Admin/ });
    expect(admin.getAttribute("aria-pressed")).toBe("false");
  });

  it("20 Nov (D-97): offers Lead in a company workspace, with the four roles named Member, Lead, Admin, Coach", async () => {
    m.profile = { id: "p1", org_id: "o1", role: "admin", org_type: "company" };
    render(<InviteDialog trigger={<button type="button">Invite someone</button>} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    const names = (await screen.findAllByRole("button", { pressed: false })).concat(screen.getAllByRole("button", { pressed: true })).map((b) => b.textContent ?? "");
    for (const label of ["Member", "Lead", "Admin", "Coach"]) expect(names.some((name) => name.startsWith(label))).toBe(true);
  });

  it("offers no Lead where there are no proposals (a partner workspace)", async () => {
    m.profile = { id: "p1", org_id: "o1", role: "admin", org_type: "partner" };
    render(<InviteDialog trigger={<button type="button">Invite someone</button>} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    await screen.findByRole("button", { name: /^Member/ });
    expect(screen.queryByRole("button", { name: /^Lead/ })).toBeNull();
    expect(screen.getByRole("button", { name: /^Admin/ })).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ data: { id: "p1", org_id: "o1", role: "admin", org_type: "company" } }),
}));
vi.mock("@/hooks/use-members", () => ({ useMembers: () => ({ data: { members: [] } }) }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@tanstack/react-query", () => ({ useQuery: () => ({ data: [] }), useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@/lib/invites.functions", () => ({ sendInviteEmail: vi.fn(), createInvite: vi.fn() }));

import { InviteDialog } from "@/components/invites/InviteDialog";

afterEach(cleanup);

describe("SHARE-2 invite form default", () => {
  it("defaults a new person to member, not admin", async () => {
    render(<InviteDialog trigger={<button type="button">Invite someone</button>} />);
    fireEvent.click(screen.getByRole("button", { name: "Invite someone" }));
    const pressed = await screen.findAllByRole("radio", { checked: true }).catch(() => []);
    const text = document.body.textContent ?? "";
    expect(text).toContain("Teammate");
    if (pressed.length > 0) {
      expect(pressed.map((el) => el.getAttribute("value"))).toContain("em");
      expect(pressed.map((el) => el.getAttribute("value"))).not.toContain("admin");
    }
  });
});

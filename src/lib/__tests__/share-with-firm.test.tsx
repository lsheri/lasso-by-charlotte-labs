// @vitest-environment jsdom
// Liam, 15 Nov: Share with firm. Company workspaces only, asked at creation, changed in Share, off for existing
// boards; admins and leads may only stop sharing; firm view lists shared boards with placed work only.
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  state: { firm: "Acme", orgId: "o1", adminOrLead: false, on: false, since: null as string | null, byName: null as string | null, canShare: true } as Record<string, unknown> | null,
  mutate: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn() }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: async () => {} }),
  useQuery: () => ({ data: mocks.state }),
  useMutation: () => ({ mutate: mocks.mutate, isPending: false }),
}));

import { FirmShareSection } from "@/components/canvas-lab/FirmShareSection";
import { FIRM_SHARE_COPY } from "@/lib/firm-share-copy";
import { briefLine } from "@/lib/firm-live-boards-shared";
import { notificationSentence } from "@/lib/notifications-shared";

afterEach(() => {
  cleanup();
  mocks.mutate.mockReset();
  mocks.state = { firm: "Acme", orgId: "o1", adminOrLead: false, on: false, since: null, byName: null, canShare: true };
});

const migration = readFileSync("supabase/migrations/20261115230000_share_with_firm.sql", "utf8");

describe("the database holds the rules", () => {
  it("starts every board unshared and lets only set_engagement_firm_share change it", () => {
    expect(migration).toContain("add column if not exists shared_with_firm boolean not null default false");
    expect(migration).toContain("shared_with_firm changes only through set_engagement_firm_share");
    expect(migration).toMatch(/settings->>'type' = 'company'/);
  });

  it("lets admins and leads only stop sharing, never coaches, and tells admins and leads", () => {
    expect(migration).toContain("(me.role in ('admin', 'lead') and not p_on)");
    expect(migration).toContain("me.role = 'coach'");
    expect(migration).toMatch(/role in \('admin', 'lead'\) and deactivated_at is null and id <> me\.id/);
  });

  it("closes self-join to the owner and checks invites that name a board", () => {
    expect(migration).toMatch(/can_self_join_engagement[\s\S]*and e\.owner_id = prof/);
    expect(migration).toContain("p.id = inv.used_by");
    expect(readFileSync("src/routes/join.tsx", "utf8")).toContain('supabase.rpc("join_board_from_invite"');
  });
});

describe("the Share dialog's Firm knowledge section", () => {
  it("shares at once and asks before stopping", () => {
    render(<FirmShareSection engagementId="b1" profileId="p1" open />);
    fireEvent.click(screen.getByRole("switch", { name: FIRM_SHARE_COPY.share }));
    expect(mocks.mutate).toHaveBeenCalledWith(true);
    cleanup();
    mocks.mutate.mockReset();
    mocks.state = { firm: "Acme", orgId: "o1", adminOrLead: false, on: true, since: "2026-11-12T10:00:00Z", byName: "you", canShare: true };
    render(<FirmShareSection engagementId="b1" profileId="p1" open />);
    expect(screen.getByText(/Shared with Acme since .* by you\./)).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: FIRM_SHARE_COPY.share }));
    expect(mocks.mutate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: FIRM_SHARE_COPY.stopConfirm }));
    expect(mocks.mutate).toHaveBeenCalledWith(false);
  });

  it("is absent outside a company workspace, and for someone who can neither share nor stop", () => {
    // Outside a company workspace the read returns nothing.
    mocks.state = null;
    const personal = render(<FirmShareSection engagementId="b1" profileId="p1" open />);
    expect(personal.queryByTestId("firm-share-section")).toBeNull();
    personal.unmount();
    mocks.state = { firm: "Acme", orgId: "o1", adminOrLead: false, on: false, since: null, byName: null, canShare: false };
    const viewer = render(<FirmShareSection engagementId="b1" profileId="p1" open />);
    expect(viewer.queryByTestId("firm-share-section")).toBeNull();
  });

  it("lets an admin who cannot share stop a shared board", () => {
    mocks.state = { firm: "Acme", orgId: "o1", adminOrLead: true, on: true, since: "2026-11-12T10:00:00Z", byName: "Sam", canShare: false };
    render(<FirmShareSection engagementId="b1" profileId="p1" open />);
    expect(screen.getByText(FIRM_SHARE_COPY.adminOnlyOff)).toBeTruthy();
  });
});

describe("creation, notifications and firm view", () => {
  it("asks only in a company workspace and sends the answer with the new board", () => {
    const dialog = readFileSync("src/components/engagements/NewEngagementDialog.tsx", "utf8");
    expect(dialog).toContain("const firmQuestion = Boolean(profile) && profileHasFirmView(profile);");
    expect(dialog).toContain("shared_with_firm: firmQuestion && shareWithFirm,");
    expect(dialog).toContain("const [shareWithFirm, setShareWithFirm] = useState(false);");
  });

  it("words the notice for admins and leads", () => {
    expect(notificationSentence({ kind: "firm_share_changed", payload: { by: "Sam", board: "Pricing", on: true } })).toBe("Sam shared Pricing with the firm.");
    expect(notificationSentence({ kind: "firm_share_changed", payload: { by: "Sam", board: "Pricing", on: false } })).toBe("Sam stopped sharing Pricing with the firm.");
  });

  it("lists shared boards with placed work only, behind the firm view gate", () => {
    const server = readFileSync("src/lib/firm-live-boards.server.ts", "utf8");
    expect(server).toContain('.eq("shared_with_firm", true)');
    expect(server).toContain('.eq("work_items.visibility", "mapped")');
    expect(readFileSync("src/lib/firm-dashboard.functions.ts", "utf8")).toMatch(/getFirmLiveBoards[\s\S]*requireFirmView/);
    expect(briefLine("  A   long\nbrief ", 8)).toBe("A long …");
    for (const line of Object.values(FIRM_SHARE_COPY)) if (typeof line === "string") expect(line).not.toMatch(/—/);
  });
});

// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { NavEngagement } from "@/lib/nav-groups";

const mocks = vi.hoisted(() => ({
  profile: { id: "p1", org_id: "o1", org_type: "company", clients_enabled: true, role: "worker" } as Record<string, unknown>,
  engagements: [] as unknown[],
  clientRows: [] as unknown[],
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a className={className}>{children}</a>
  ),
  useMatchRoute: () => () => false,
  useSearch: () => ({}),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ getQueryData: () => undefined, getQueryCache: () => ({ subscribe: () => () => {} }) }),
}));
vi.mock("@/hooks/use-profile", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useProfile: () => ({ data: mocks.profile, profiles: [mocks.profile] }),
}));
vi.mock("@/hooks/use-engagements", () => ({
  useEngagements: () => ({ data: mocks.engagements }),
}));
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: mocks.clientRows }),
  useInvalidateClients: () => () => {},
}));
vi.mock("@/components/engagements/SidebarCreateActions", () => ({
  SidebarCreateActions: () => (
    <>
      <button type="button">New client</button>
      <button type="button">New folder</button>
    </>
  ),
}));
vi.mock("@/hooks/use-affiliation", () => ({ useAffiliation: () => ({ data: null }) }));
vi.mock("@/hooks/use-coach-note-thread", () => ({ useUnreadNotesAboutMe: () => ({ data: [] }) }));
vi.mock("@/hooks/use-coaching-links", () => ({ useHasLiveCoachLink: () => false }));
vi.mock("@/hooks/use-coaching-reach", () => ({ useCoachingReach: () => ({ canReach: false }) }));
vi.mock("@/hooks/use-shared-with-me", () => ({ useSharedWithMe: () => ({ groups: [] }) }));
vi.mock("@/hooks/use-decisions", () => ({ useDecisions: () => ({ data: [] }) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn(), bucket: () => "0" }));
vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));

import { SidebarNav } from "@/components/layout/SidebarNav";

afterEach(() => {
  cleanup();
  mocks.engagements = [];
  mocks.clientRows = [];
});

const eng = (id: string, clients: NavEngagement["clients"]): NavEngagement => ({
  id,
  code: id.toUpperCase(),
  title: `Title ${id}`,
  clients,
});

const manyBoards = () =>
  Array.from({ length: 24 }, (_, i) =>
    eng(`e${i}`, { id: `c${i}`, name: `Client ${i}`, quick_folder: false, kind: "client", parent_id: null }),
  );

describe("SB1 tree scroller and standing separation", () => {
  it("wraps the tree rows in the scroller and keeps the actions outside it", () => {
    mocks.engagements = manyBoards();
    const { container } = render(<SidebarNav />);
    const scroller = container.querySelector(".nb-nav-tree-scroll");
    expect(scroller).not.toBeNull();
    // The tree rows live inside the scroller.
    expect(scroller!.querySelector('[data-drop-zone="top"]')).not.toBeNull();
    expect(scroller!.textContent).toContain("Title e0");
    expect(scroller!.textContent).toContain("Title e23");
    // The actions block exists and is not inside the scroller.
    const actions = container.querySelector(".nb-nav-actions");
    expect(actions).not.toBeNull();
    expect(scroller!.contains(actions)).toBe(false);
    expect(actions!.contains(scroller!)).toBe(false);
  });

  it("sits the actions block after the tree in DOM order, with the top border rule", () => {
    mocks.engagements = manyBoards();
    const { container } = render(<SidebarNav />);
    const scroller = container.querySelector(".nb-nav-tree-scroll")!;
    const actions = container.querySelector(".nb-nav-actions")!;
    expect(
      scroller.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    // The standing separation is a hairline rule on the actions block. jsdom
    // does not load the stylesheet, so the rule is read from the sheet itself.
    const css = readFileSync(new URL("../../styles.css", import.meta.url), "utf8");
    const rule = css.match(/\.nb-nav-actions\s*\{[^}]*\}/);
    expect(rule).not.toBeNull();
    expect(rule![0]).toContain("border-top: 1px solid var(--nb-rule)");
    const scrollRule = css.match(/\.nb-nav-tree-scroll\s*\{[^}]*\}/);
    expect(scrollRule).not.toBeNull();
    expect(scrollRule![0]).toContain("overflow-y: auto");
  });

  it("keeps New workboard, New folder and Past work present with a long tree", () => {
    mocks.engagements = manyBoards();
    render(<SidebarNav />);
    expect(screen.getByText("New workboard")).toBeTruthy();
    expect(screen.getByText("New folder")).toBeTruthy();
    expect(screen.getByText("Past work")).toBeTruthy();
  });

  it("keeps the separation when the tree is empty", () => {
    mocks.engagements = [];
    const { container } = render(<SidebarNav />);
    const scroller = container.querySelector(".nb-nav-tree-scroll");
    const actions = container.querySelector(".nb-nav-actions");
    expect(scroller).not.toBeNull();
    expect(actions).not.toBeNull();
    // The empty-tree line lives in the scroller; the actions still follow it.
    expect(scroller!.textContent).toContain("No workboards yet");
    expect(
      scroller!.compareDocumentPosition(actions!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByText("New workboard")).toBeTruthy();
    expect(screen.getByText("Past work")).toBeTruthy();
  });
});

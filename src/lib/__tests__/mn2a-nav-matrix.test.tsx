// @vitest-environment jsdom
/**
 * MN-2a: the navigation matrix. Records, for every workspace shape this app
 * draws a nav for, the ordered group headings and items the desktop sidebar
 * renders, plus the phone You sheet list. The expected output is an explicit
 * inline table, written against the nav as it stood before the manifest, so
 * moving the rules into one manifest can be proven to change nothing visible.
 */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  profile: null as Record<string, unknown> | null,
  canReach: false,
  coachLink: false,
  affiliated: false,
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    hash,
    className,
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, string>;
    hash?: string;
    className?: string;
  }) => {
    const query = search ? `?${new URLSearchParams(search).toString()}` : "";
    const fragment = hash ? `#${hash}` : "";
    return (
      <a href={`${to}${query}${fragment}`} className={className}>
        {children}
      </a>
    );
  },
  useMatchRoute: () => () => false,
  useSearch: () => ({}),
  useNavigate: () => () => {},
  useRouterState: () => "/home",
}));
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
  useQueryClient: () => ({
    getQueryData: () => undefined,
    getQueryCache: () => ({ subscribe: () => () => {} }),
  }),
}));
vi.mock("@/hooks/use-profile", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useProfile: () => ({ data: mocks.profile, profiles: mocks.profile ? [mocks.profile] : [] }),
}));
vi.mock("@/hooks/use-engagements", () => ({ useEngagements: () => ({ data: [] }) }));
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: [] }),
  useInvalidateClients: () => () => {},
}));
vi.mock("@/hooks/use-work-items", () => ({ useWorkItems: () => ({ data: { items: [] } }) }));
vi.mock("@/components/engagements/SidebarCreateActions", () => ({ SidebarCreateActions: () => null }));
vi.mock("@/components/engagements/NewEngagementDialog", () => ({
  NewEngagementDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));
vi.mock("@/hooks/use-affiliation", () => ({
  useAffiliation: () => ({
    data: mocks.affiliated ? { institution: { name: "Artemis" } } : null,
  }),
}));
vi.mock("@/hooks/use-coach-note-thread", () => ({ useUnreadNotesAboutMe: () => ({ data: [] }) }));
vi.mock("@/hooks/use-coaching-links", () => ({ useHasLiveCoachLink: () => mocks.coachLink }));
vi.mock("@/hooks/use-coaching-reach", () => ({
  useCoachingReach: () => ({ engagementIds: [], profileIds: [], canReach: mocks.canReach }),
}));
vi.mock("@/hooks/use-shared-with-me", () => ({ useSharedWithMe: () => ({ groups: [] }) }));
vi.mock("@/hooks/use-decisions", () => ({ useDecisions: () => ({ data: [] }) }));
vi.mock("@/lib/telemetry", () => ({ logEvent: vi.fn(), bucket: () => "0" }));
vi.mock("@/components/coaching/CoachAskSheet", () => ({ CoachAskSheet: () => null }));
vi.mock("@/components/feedback/FeedbackWidget", () => ({
  FeedbackDialog: ({ trigger }: { trigger: ReactNode }) => <>{trigger}</>,
}));
vi.mock("@/components/reflect/ask-lasso-context", () => ({ useAskLassoHandler: () => null }));
vi.mock("@/components/layout/OrgSwitcher", () => ({ OrgSwitcher: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signOut: async () => {} } } }));
vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: ReactNode }) =>
    open ? <div data-testid="open-sheet">{children}</div> : null,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { SidebarNav } from "@/components/layout/SidebarNav";
import { navFor } from "@/components/layout/nav-config";
import { vocabFor } from "@/lib/edu-vocab";

type Combo = {
  type: "company" | "partner" | "personal" | "edu";
  role: "em" | "lead" | "admin" | "coach";
  canReview: boolean;
  coachLink: boolean;
  affiliated: boolean;
  clientsEnabled: boolean;
};

function combos(): Combo[] {
  const out: Combo[] = [];
  for (const type of ["company", "partner", "personal", "edu"] as const)
    for (const role of ["em", "lead", "admin", "coach"] as const)
      for (const canReview of [true, false])
        for (const coachLink of type === "personal" ? [true, false] : [false])
          for (const affiliated of type === "company" || type === "partner" ? [true, false] : [false])
            for (const clientsEnabled of [true, false])
              out.push({ type, role, canReview, coachLink, affiliated, clientsEnabled });
  return out;
}

function keyOf(c: Combo): string {
  return [
    c.type,
    c.role,
    c.canReview ? "review" : "noreview",
    c.coachLink ? "link" : "nolink",
    c.affiliated ? "affil" : "noaffil",
    c.clientsEnabled ? "clients" : "noclients",
  ].join("|");
}

function describeNode(node: Element): string {
  const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
  if (node.classList.contains("nb-group-header")) return `# ${text}`;
  if (node.tagName === "A") return `${text} -> ${node.getAttribute("href")}`;
  if (node.getAttribute("aria-disabled") === "true") return `${text} [disabled]`;
  return `${text} [button]`;
}

function setup(c: Combo) {
  mocks.profile = {
    id: "p1",
    org_id: "o1",
    role: c.role,
    org_type: c.type,
    display_name: "Test",
    clients_enabled: c.clientsEnabled,
  };
  mocks.canReach = c.canReview;
  mocks.coachLink = c.coachLink;
  mocks.affiliated = c.affiliated;
}

function sidebarFor(c: Combo): string {
  setup(c);
  const { container } = render(<SidebarNav />);
  const nodes = container.querySelectorAll(".nb-group-header, a, button");
  const lines = Array.from(nodes).map(describeNode);
  cleanup();
  return lines.join("\n");
}

function youSheetFor(c: Combo): string {
  setup(c);
  render(<MobileTabBar />);
  fireEvent.click(screen.getByRole("button", { name: "More" }));
  const sheet = screen.getByTestId("open-sheet");
  const lines = Array.from(sheet.querySelectorAll(".nb-group-header, .nb-nav-item")).map((node) =>
    describeNode(node).replace(/\s*Coming soon \[disabled\]$/, " [disabled]"),
  );
  cleanup();
  return lines.join("\n");
}

afterEach(() => cleanup());

// ---- Expected layouts: recorded before the manifest, updated for MN-3a, MN-3b and the NAV-2 rail (Home, Create, Boards, headless rows, Sources and Settings at the foot). ----
const SIDEBAR_LAYOUTS: Record<string, string> = {
  N1: [
    "Home -> /home",
    "Create [button]",
    "# Boards",
    "All work -> /work",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "People you coach -> /coaching",
    "Sources -> /connectors",
    "Settings [button]",
  ].join("\n"),
  N2: [
    "Home -> /home",
    "Create [button]",
    "# Boards",
    "All work -> /work",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "Sources -> /connectors",
    "Settings [button]",
  ].join("\n"),
  N3: [
    "Home -> /home",
    "Create [button]",
    "# Boards",
    "All work -> /work",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "People you coach -> /coaching",
    "Firm view -> /firm",
    "Sources -> /connectors",
    "Settings [button]",
  ].join("\n"),
  N4: [
    "Home -> /home",
    "Create [button]",
    "# Boards",
    "All work -> /work",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "Firm view -> /firm",
    "Sources -> /connectors",
    "Settings [button]",
  ].join("\n"),
  N5: [
    "# Coaching",
    "People you coach -> /coaching",
    "# Your account",
    "1:1 prep -> /one-on-one",
  ].join("\n"),
  N6: [
    "# Your account",
    "1:1 prep -> /one-on-one",
  ].join("\n"),
  N7: [
    "Home -> /home",
    "Create [button]",
    "# Boards",
    "All work -> /work",
    "Look back -> /archive",
    "People you coach -> /coaching",
    "Sources -> /connectors",
    "Settings [button]",
  ].join("\n"),
  N8: [
    "Home -> /home",
    "Create [button]",
    "# Boards",
    "All work -> /work",
    "Look back -> /archive",
    "Sources -> /connectors",
    "Settings [button]",
  ].join("\n"),
};
const YOU_LAYOUTS: Record<string, string> = {
  Y1: [
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Past Ask Lasso chats -> /ai-record?view=asked",
    "Find itComing soon [disabled]",
    "Decision logComing soon [disabled]",
    "1:1 prep -> /one-on-one",
    "People you coach -> /coaching",
    "Settings -> /settings",
    "Where work lives -> /connectors",
  ].join("\n"),
  Y2: [
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Past Ask Lasso chats -> /ai-record?view=asked",
    "Find itComing soon [disabled]",
    "Decision logComing soon [disabled]",
    "1:1 prep -> /one-on-one",
    "Settings -> /settings",
    "Where work lives -> /connectors",
  ].join("\n"),
  Y3: [
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Past Ask Lasso chats -> /ai-record?view=asked",
    "Find itComing soon [disabled]",
    "Decision logComing soon [disabled]",
    "1:1 prep -> /one-on-one",
    "People you coach -> /coaching",
    "Firm view -> /firm",
    "Members -> /members",
    "Settings -> /settings",
    "Where work lives -> /connectors",
  ].join("\n"),
  Y4: [
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Past Ask Lasso chats -> /ai-record?view=asked",
    "Find itComing soon [disabled]",
    "Decision logComing soon [disabled]",
    "1:1 prep -> /one-on-one",
    "Firm view -> /firm",
    "Members -> /members",
    "Settings -> /settings",
    "Where work lives -> /connectors",
  ].join("\n"),
  Y5: [
    "1:1 prep -> /one-on-one",
    "Settings -> /settings",
  ].join("\n"),
  Y6: [
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Past Ask Lasso chats -> /ai-record?view=asked",
    "Find itComing soon [disabled]",
    "Decision logComing soon [disabled]",
    "1:1 prep -> /one-on-one",
    "People you coach -> /coaching",
    "Members -> /members",
    "Settings -> /settings",
    "Where work lives -> /connectors",
  ].join("\n"),
  Y7: [
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Past Ask Lasso chats -> /ai-record?view=asked",
    "Find itComing soon [disabled]",
    "Decision logComing soon [disabled]",
    "1:1 prep -> /one-on-one",
    "Members -> /members",
    "Settings -> /settings",
    "Where work lives -> /connectors",
  ].join("\n"),
  Y8: [
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Past Ask Lasso chats -> /ai-record?view=asked",
    "Find itComing soon [disabled]",
    "Decision logComing soon [disabled]",
    "1:1 prep -> /one-on-one",
    "People you coach -> /coaching",
    "Your coaches -> /members",
    "Settings -> /settings",
    "Where work lives -> /connectors",
  ].join("\n"),
  Y9: [
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Past Ask Lasso chats -> /ai-record?view=asked",
    "Find itComing soon [disabled]",
    "Decision logComing soon [disabled]",
    "1:1 prep -> /one-on-one",
    "Your coaches -> /members",
    "Settings -> /settings",
    "Where work lives -> /connectors",
  ].join("\n"),
};
const EXPECTED: Record<string, [sidebar: string, you: string]> = {
  "company|em|review|nolink|affil|clients": ["N1", "Y1"],
  "company|em|review|nolink|affil|noclients": ["N1", "Y1"],
  "company|em|review|nolink|noaffil|clients": ["N1", "Y1"],
  "company|em|review|nolink|noaffil|noclients": ["N1", "Y1"],
  "company|em|noreview|nolink|affil|clients": ["N2", "Y2"],
  "company|em|noreview|nolink|affil|noclients": ["N2", "Y2"],
  "company|em|noreview|nolink|noaffil|clients": ["N2", "Y2"],
  "company|em|noreview|nolink|noaffil|noclients": ["N2", "Y2"],
  "company|lead|review|nolink|affil|clients": ["N3", "Y3"],
  "company|lead|review|nolink|affil|noclients": ["N3", "Y3"],
  "company|lead|review|nolink|noaffil|clients": ["N3", "Y3"],
  "company|lead|review|nolink|noaffil|noclients": ["N3", "Y3"],
  "company|lead|noreview|nolink|affil|clients": ["N4", "Y4"],
  "company|lead|noreview|nolink|affil|noclients": ["N4", "Y4"],
  "company|lead|noreview|nolink|noaffil|clients": ["N4", "Y4"],
  "company|lead|noreview|nolink|noaffil|noclients": ["N4", "Y4"],
  "company|admin|review|nolink|affil|clients": ["N3", "Y3"],
  "company|admin|review|nolink|affil|noclients": ["N3", "Y3"],
  "company|admin|review|nolink|noaffil|clients": ["N3", "Y3"],
  "company|admin|review|nolink|noaffil|noclients": ["N3", "Y3"],
  "company|admin|noreview|nolink|affil|clients": ["N4", "Y4"],
  "company|admin|noreview|nolink|affil|noclients": ["N4", "Y4"],
  "company|admin|noreview|nolink|noaffil|clients": ["N4", "Y4"],
  "company|admin|noreview|nolink|noaffil|noclients": ["N4", "Y4"],
  "company|coach|review|nolink|affil|clients": ["N5", "Y5"],
  "company|coach|review|nolink|affil|noclients": ["N5", "Y5"],
  "company|coach|review|nolink|noaffil|clients": ["N5", "Y5"],
  "company|coach|review|nolink|noaffil|noclients": ["N5", "Y5"],
  "company|coach|noreview|nolink|affil|clients": ["N6", "Y5"],
  "company|coach|noreview|nolink|affil|noclients": ["N6", "Y5"],
  "company|coach|noreview|nolink|noaffil|clients": ["N6", "Y5"],
  "company|coach|noreview|nolink|noaffil|noclients": ["N6", "Y5"],
  "partner|em|review|nolink|affil|clients": ["N7", "Y1"],
  "partner|em|review|nolink|affil|noclients": ["N7", "Y1"],
  "partner|em|review|nolink|noaffil|clients": ["N7", "Y1"],
  "partner|em|review|nolink|noaffil|noclients": ["N7", "Y1"],
  "partner|em|noreview|nolink|affil|clients": ["N8", "Y2"],
  "partner|em|noreview|nolink|affil|noclients": ["N8", "Y2"],
  "partner|em|noreview|nolink|noaffil|clients": ["N8", "Y2"],
  "partner|em|noreview|nolink|noaffil|noclients": ["N8", "Y2"],
  "partner|lead|review|nolink|affil|clients": ["N7", "Y6"],
  "partner|lead|review|nolink|affil|noclients": ["N7", "Y6"],
  "partner|lead|review|nolink|noaffil|clients": ["N7", "Y6"],
  "partner|lead|review|nolink|noaffil|noclients": ["N7", "Y6"],
  "partner|lead|noreview|nolink|affil|clients": ["N8", "Y7"],
  "partner|lead|noreview|nolink|affil|noclients": ["N8", "Y7"],
  "partner|lead|noreview|nolink|noaffil|clients": ["N8", "Y7"],
  "partner|lead|noreview|nolink|noaffil|noclients": ["N8", "Y7"],
  "partner|admin|review|nolink|affil|clients": ["N7", "Y6"],
  "partner|admin|review|nolink|affil|noclients": ["N7", "Y6"],
  "partner|admin|review|nolink|noaffil|clients": ["N7", "Y6"],
  "partner|admin|review|nolink|noaffil|noclients": ["N7", "Y6"],
  "partner|admin|noreview|nolink|affil|clients": ["N8", "Y7"],
  "partner|admin|noreview|nolink|affil|noclients": ["N8", "Y7"],
  "partner|admin|noreview|nolink|noaffil|clients": ["N8", "Y7"],
  "partner|admin|noreview|nolink|noaffil|noclients": ["N8", "Y7"],
  "partner|coach|review|nolink|affil|clients": ["N5", "Y5"],
  "partner|coach|review|nolink|affil|noclients": ["N5", "Y5"],
  "partner|coach|review|nolink|noaffil|clients": ["N5", "Y5"],
  "partner|coach|review|nolink|noaffil|noclients": ["N5", "Y5"],
  "partner|coach|noreview|nolink|affil|clients": ["N6", "Y5"],
  "partner|coach|noreview|nolink|affil|noclients": ["N6", "Y5"],
  "partner|coach|noreview|nolink|noaffil|clients": ["N6", "Y5"],
  "partner|coach|noreview|nolink|noaffil|noclients": ["N6", "Y5"],
  "personal|em|review|link|noaffil|clients": ["N1", "Y1"],
  "personal|em|review|link|noaffil|noclients": ["N1", "Y1"],
  "personal|em|review|nolink|noaffil|clients": ["N7", "Y1"],
  "personal|em|review|nolink|noaffil|noclients": ["N7", "Y1"],
  "personal|em|noreview|link|noaffil|clients": ["N2", "Y2"],
  "personal|em|noreview|link|noaffil|noclients": ["N2", "Y2"],
  "personal|em|noreview|nolink|noaffil|clients": ["N8", "Y2"],
  "personal|em|noreview|nolink|noaffil|noclients": ["N8", "Y2"],
  "personal|lead|review|link|noaffil|clients": ["N1", "Y8"],
  "personal|lead|review|link|noaffil|noclients": ["N1", "Y8"],
  "personal|lead|review|nolink|noaffil|clients": ["N7", "Y8"],
  "personal|lead|review|nolink|noaffil|noclients": ["N7", "Y8"],
  "personal|lead|noreview|link|noaffil|clients": ["N2", "Y9"],
  "personal|lead|noreview|link|noaffil|noclients": ["N2", "Y9"],
  "personal|lead|noreview|nolink|noaffil|clients": ["N8", "Y9"],
  "personal|lead|noreview|nolink|noaffil|noclients": ["N8", "Y9"],
  "personal|admin|review|link|noaffil|clients": ["N1", "Y8"],
  "personal|admin|review|link|noaffil|noclients": ["N1", "Y8"],
  "personal|admin|review|nolink|noaffil|clients": ["N7", "Y8"],
  "personal|admin|review|nolink|noaffil|noclients": ["N7", "Y8"],
  "personal|admin|noreview|link|noaffil|clients": ["N2", "Y9"],
  "personal|admin|noreview|link|noaffil|noclients": ["N2", "Y9"],
  "personal|admin|noreview|nolink|noaffil|clients": ["N8", "Y9"],
  "personal|admin|noreview|nolink|noaffil|noclients": ["N8", "Y9"],
  "personal|coach|review|link|noaffil|clients": ["N5", "Y5"],
  "personal|coach|review|link|noaffil|noclients": ["N5", "Y5"],
  "personal|coach|review|nolink|noaffil|clients": ["N5", "Y5"],
  "personal|coach|review|nolink|noaffil|noclients": ["N5", "Y5"],
  "personal|coach|noreview|link|noaffil|clients": ["N6", "Y5"],
  "personal|coach|noreview|link|noaffil|noclients": ["N6", "Y5"],
  "personal|coach|noreview|nolink|noaffil|clients": ["N6", "Y5"],
  "personal|coach|noreview|nolink|noaffil|noclients": ["N6", "Y5"],
  "edu|em|review|nolink|noaffil|clients": ["N1", "Y1"],
  "edu|em|review|nolink|noaffil|noclients": ["N1", "Y1"],
  "edu|em|noreview|nolink|noaffil|clients": ["N2", "Y2"],
  "edu|em|noreview|nolink|noaffil|noclients": ["N2", "Y2"],
  "edu|lead|review|nolink|noaffil|clients": ["N1", "Y8"],
  "edu|lead|review|nolink|noaffil|noclients": ["N1", "Y8"],
  "edu|lead|noreview|nolink|noaffil|clients": ["N2", "Y9"],
  "edu|lead|noreview|nolink|noaffil|noclients": ["N2", "Y9"],
  "edu|admin|review|nolink|noaffil|clients": ["N1", "Y8"],
  "edu|admin|review|nolink|noaffil|noclients": ["N1", "Y8"],
  "edu|admin|noreview|nolink|noaffil|clients": ["N2", "Y9"],
  "edu|admin|noreview|nolink|noaffil|noclients": ["N2", "Y9"],
  "edu|coach|review|nolink|noaffil|clients": ["N5", "Y5"],
  "edu|coach|review|nolink|noaffil|noclients": ["N5", "Y5"],
  "edu|coach|noreview|nolink|noaffil|clients": ["N6", "Y5"],
  "edu|coach|noreview|nolink|noaffil|noclients": ["N6", "Y5"],
};

describe("MN-2a navigation matrix", () => {
  const all = combos();

  it("covers every combination in the table", () => {
    expect(all.map(keyOf).sort()).toEqual(Object.keys(EXPECTED).sort());
  });

  for (const c of all) {
    it(keyOf(c), () => {
      const expected = EXPECTED[keyOf(c)];
      if (!expected) throw new Error("Missing matrix row");
      const [sidebarId] = expected;
      expect(sidebarFor(c)).toBe(SIDEBAR_LAYOUTS[sidebarId]);
      // NAV-3: the phone More sheet is a decided flat list for workers: no
      // headings, no Create, no All work, then the switcher rows. The guest
      // sheet still mirrors its sidebar under a Workspace heading.
      const guest = c.role === "coach";
      const moreLines = (SIDEBAR_LAYOUTS[sidebarId] ?? "").split("\n").filter((line) =>
        guest || (!line.startsWith("# ") && line !== "All work -> /work" && line !== "Create [button]"));
      const workspaceRows = navFor({ ...c, hasCoachLink: c.coachLink, workItemCount: 0,
        canManageMembers: c.role === "admin" || c.role === "lead",
        canSeeFirmView: c.type === "company" && (c.role === "admin" || c.role === "lead") },
        { vocab: vocabFor({ org_type: c.type }), institutionName: c.affiliated ? "Artemis" : null })
        .filter((group) => group.placement === "workspace_menu").flatMap((group) => group.items)
        .map((item) => item.to ? `${item.label} -> ${item.to}` : `${item.label} [button]`);
      expect(youSheetFor(c)).toBe([...moreLines, ...(guest ? ["# Workspace"] : []), ...workspaceRows].join("\n"));
    });
  }
});


describe("MN-5: From your people in the manifest", () => {
  const base = { role: "em", canReview: false, canManageMembers: false, canSeeFirmView: false,
    hasCoachLink: false, affiliated: false, clientsEnabled: true, workItemCount: 3 };
  const labels = { vocab: vocabFor({ org_type: "partner" }), institutionName: null };
  it("a partner with shared boards: NAV-2 retired the row, so the list renders under Shared with you, not as a manifest group", () => {
    const ids = navFor({ ...base, type: "partner", partnerShareCount: 2 }, labels).map((g) => g.id);
    expect(ids).not.toContain("from_your_people");
  });
  it("absent with no shares and outside partner workspaces", () => {
    expect(navFor({ ...base, type: "partner", partnerShareCount: 0 }, labels).map((g) => g.id)).not.toContain("from_your_people");
    expect(navFor({ ...base, type: "company", partnerShareCount: 2 }, labels).map((g) => g.id)).not.toContain("from_your_people");
  });
});


describe("NAV-2: one Boards heading for every workspace type", () => {
  it("company, partner, edu and personal render the same Boards heading and no other main group has a visible heading", () => {
    const headings = (["company", "partner", "edu", "personal"] as const).map((type) => {
      const c: Combo = { type, role: "admin", canReview: true, coachLink: true, affiliated: false, clientsEnabled: true };
      return sidebarFor(c).split("\n").filter((line) => line.startsWith("# "));
    });
    expect(headings).toEqual([["# Boards"], ["# Boards"], ["# Boards"], ["# Boards"]]);
    for (const type of ["company", "partner", "edu", "personal"] as const) {
      const groups = navFor({ type, role: "admin", canReview: true, canManageMembers: true, canSeeFirmView: type === "company",
        hasCoachLink: true, affiliated: false, clientsEnabled: true, workItemCount: 0 },
        { vocab: vocabFor({ org_type: type }), institutionName: null });
      expect(groups.find((g) => g.id === "engagements")?.label).toBe("Boards");
      expect(groups.filter((g) => g.placement === "main" && g.id !== "engagements" && !g.headless).map((g) => g.id)).toEqual([]);
    }
  });
});

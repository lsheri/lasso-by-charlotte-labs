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

// ---- Expected layouts: recorded before the manifest, updated for MN-3a and the MN-3b lean sidebar. ----
const SIDEBAR_LAYOUTS: Record<string, string> = {
  S1: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "# Your account",
    "Your Artemis link -> /affiliation",
  ].join("\n"),
  S2: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
  ].join("\n"),
  S3: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "# Your account",
    "Your Artemis link -> /affiliation",
  ].join("\n"),
  S4: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
  ].join("\n"),
  S5: [
    "# Coaching",
    "People you coach -> /coaching",
    "# Your account",
    "1:1 prep -> /one-on-one",
  ].join("\n"),
  S6: [
    "# Your account",
    "1:1 prep -> /one-on-one",
  ].join("\n"),
  S7: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Your clients",
    " [button]",
    "Look back -> /archive",
    "# Your account",
    "Your Artemis link -> /affiliation",
  ].join("\n"),
  S8: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Your clients",
    " [button]",
    "Look back -> /archive",
  ].join("\n"),
  S9: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Your clients",
    " [button]",
    "Look back -> /archive",
    "# Your account",
    "Your Artemis link -> /affiliation",
  ].join("\n"),
  S10: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Your clients",
    " [button]",
    "Look back -> /archive",
  ].join("\n"),
  S11: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
  ].join("\n"),
  S12: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
  ].join("\n"),
  S13: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "# Who you share with",
    "Your coaches -> /members",
  ].join("\n"),
  S14: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
    "# Who you share with",
    "Your coaches -> /members",
  ].join("\n"),
  S15: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "# Who you share with",
    "Your coaches -> /members",
  ].join("\n"),
  S16: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Where it goes",
    " [button]",
    "Look back -> /archive",
    "# Who you share with",
    "Your coaches -> /members",
  ].join("\n"),
  S17: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Workboards",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
  ].join("\n"),
  S18: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Workboards",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
  ].join("\n"),
  S19: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Coaching",
    "People you coach -> /coaching",
    "# Workboards",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "# Who you share with",
    "Your coaches -> /members",
  ].join("\n"),
  S20: [
    "# What landed",
    "Home -> /home",
    "All work -> /work",
    "All AI Conversations -> /ai-record",
    "Connect your AI tools -> /connectors",
    "# Workboards",
    " [button]",
    "Look back -> /archive",
    "Your coach -> /one-on-one",
    "# Who you share with",
    "Your coaches -> /members",
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
  "company|em|review|nolink|affil|clients": ["S1", "Y1"],
  "company|em|review|nolink|affil|noclients": ["S1", "Y1"],
  "company|em|review|nolink|noaffil|clients": ["S2", "Y1"],
  "company|em|review|nolink|noaffil|noclients": ["S2", "Y1"],
  "company|em|noreview|nolink|affil|clients": ["S3", "Y2"],
  "company|em|noreview|nolink|affil|noclients": ["S3", "Y2"],
  "company|em|noreview|nolink|noaffil|clients": ["S4", "Y2"],
  "company|em|noreview|nolink|noaffil|noclients": ["S4", "Y2"],
  "company|lead|review|nolink|affil|clients": ["S1", "Y3"],
  "company|lead|review|nolink|affil|noclients": ["S1", "Y3"],
  "company|lead|review|nolink|noaffil|clients": ["S2", "Y3"],
  "company|lead|review|nolink|noaffil|noclients": ["S2", "Y3"],
  "company|lead|noreview|nolink|affil|clients": ["S3", "Y4"],
  "company|lead|noreview|nolink|affil|noclients": ["S3", "Y4"],
  "company|lead|noreview|nolink|noaffil|clients": ["S4", "Y4"],
  "company|lead|noreview|nolink|noaffil|noclients": ["S4", "Y4"],
  "company|admin|review|nolink|affil|clients": ["S1", "Y3"],
  "company|admin|review|nolink|affil|noclients": ["S1", "Y3"],
  "company|admin|review|nolink|noaffil|clients": ["S2", "Y3"],
  "company|admin|review|nolink|noaffil|noclients": ["S2", "Y3"],
  "company|admin|noreview|nolink|affil|clients": ["S3", "Y4"],
  "company|admin|noreview|nolink|affil|noclients": ["S3", "Y4"],
  "company|admin|noreview|nolink|noaffil|clients": ["S4", "Y4"],
  "company|admin|noreview|nolink|noaffil|noclients": ["S4", "Y4"],
  "company|coach|review|nolink|affil|clients": ["S5", "Y5"],
  "company|coach|review|nolink|affil|noclients": ["S5", "Y5"],
  "company|coach|review|nolink|noaffil|clients": ["S5", "Y5"],
  "company|coach|review|nolink|noaffil|noclients": ["S5", "Y5"],
  "company|coach|noreview|nolink|affil|clients": ["S6", "Y5"],
  "company|coach|noreview|nolink|affil|noclients": ["S6", "Y5"],
  "company|coach|noreview|nolink|noaffil|clients": ["S6", "Y5"],
  "company|coach|noreview|nolink|noaffil|noclients": ["S6", "Y5"],
  "partner|em|review|nolink|affil|clients": ["S7", "Y1"],
  "partner|em|review|nolink|affil|noclients": ["S7", "Y1"],
  "partner|em|review|nolink|noaffil|clients": ["S8", "Y1"],
  "partner|em|review|nolink|noaffil|noclients": ["S8", "Y1"],
  "partner|em|noreview|nolink|affil|clients": ["S9", "Y2"],
  "partner|em|noreview|nolink|affil|noclients": ["S9", "Y2"],
  "partner|em|noreview|nolink|noaffil|clients": ["S10", "Y2"],
  "partner|em|noreview|nolink|noaffil|noclients": ["S10", "Y2"],
  "partner|lead|review|nolink|affil|clients": ["S7", "Y6"],
  "partner|lead|review|nolink|affil|noclients": ["S7", "Y6"],
  "partner|lead|review|nolink|noaffil|clients": ["S8", "Y6"],
  "partner|lead|review|nolink|noaffil|noclients": ["S8", "Y6"],
  "partner|lead|noreview|nolink|affil|clients": ["S9", "Y7"],
  "partner|lead|noreview|nolink|affil|noclients": ["S9", "Y7"],
  "partner|lead|noreview|nolink|noaffil|clients": ["S10", "Y7"],
  "partner|lead|noreview|nolink|noaffil|noclients": ["S10", "Y7"],
  "partner|admin|review|nolink|affil|clients": ["S7", "Y6"],
  "partner|admin|review|nolink|affil|noclients": ["S7", "Y6"],
  "partner|admin|review|nolink|noaffil|clients": ["S8", "Y6"],
  "partner|admin|review|nolink|noaffil|noclients": ["S8", "Y6"],
  "partner|admin|noreview|nolink|affil|clients": ["S9", "Y7"],
  "partner|admin|noreview|nolink|affil|noclients": ["S9", "Y7"],
  "partner|admin|noreview|nolink|noaffil|clients": ["S10", "Y7"],
  "partner|admin|noreview|nolink|noaffil|noclients": ["S10", "Y7"],
  "partner|coach|review|nolink|affil|clients": ["S5", "Y5"],
  "partner|coach|review|nolink|affil|noclients": ["S5", "Y5"],
  "partner|coach|review|nolink|noaffil|clients": ["S5", "Y5"],
  "partner|coach|review|nolink|noaffil|noclients": ["S5", "Y5"],
  "partner|coach|noreview|nolink|affil|clients": ["S6", "Y5"],
  "partner|coach|noreview|nolink|affil|noclients": ["S6", "Y5"],
  "partner|coach|noreview|nolink|noaffil|clients": ["S6", "Y5"],
  "partner|coach|noreview|nolink|noaffil|noclients": ["S6", "Y5"],
  "personal|em|review|link|noaffil|clients": ["S2", "Y1"],
  "personal|em|review|link|noaffil|noclients": ["S2", "Y1"],
  "personal|em|review|nolink|noaffil|clients": ["S11", "Y1"],
  "personal|em|review|nolink|noaffil|noclients": ["S11", "Y1"],
  "personal|em|noreview|link|noaffil|clients": ["S4", "Y2"],
  "personal|em|noreview|link|noaffil|noclients": ["S4", "Y2"],
  "personal|em|noreview|nolink|noaffil|clients": ["S12", "Y2"],
  "personal|em|noreview|nolink|noaffil|noclients": ["S12", "Y2"],
  "personal|lead|review|link|noaffil|clients": ["S13", "Y8"],
  "personal|lead|review|link|noaffil|noclients": ["S13", "Y8"],
  "personal|lead|review|nolink|noaffil|clients": ["S14", "Y8"],
  "personal|lead|review|nolink|noaffil|noclients": ["S14", "Y8"],
  "personal|lead|noreview|link|noaffil|clients": ["S15", "Y9"],
  "personal|lead|noreview|link|noaffil|noclients": ["S15", "Y9"],
  "personal|lead|noreview|nolink|noaffil|clients": ["S16", "Y9"],
  "personal|lead|noreview|nolink|noaffil|noclients": ["S16", "Y9"],
  "personal|admin|review|link|noaffil|clients": ["S13", "Y8"],
  "personal|admin|review|link|noaffil|noclients": ["S13", "Y8"],
  "personal|admin|review|nolink|noaffil|clients": ["S14", "Y8"],
  "personal|admin|review|nolink|noaffil|noclients": ["S14", "Y8"],
  "personal|admin|noreview|link|noaffil|clients": ["S15", "Y9"],
  "personal|admin|noreview|link|noaffil|noclients": ["S15", "Y9"],
  "personal|admin|noreview|nolink|noaffil|clients": ["S16", "Y9"],
  "personal|admin|noreview|nolink|noaffil|noclients": ["S16", "Y9"],
  "personal|coach|review|link|noaffil|clients": ["S5", "Y5"],
  "personal|coach|review|link|noaffil|noclients": ["S5", "Y5"],
  "personal|coach|review|nolink|noaffil|clients": ["S5", "Y5"],
  "personal|coach|review|nolink|noaffil|noclients": ["S5", "Y5"],
  "personal|coach|noreview|link|noaffil|clients": ["S6", "Y5"],
  "personal|coach|noreview|link|noaffil|noclients": ["S6", "Y5"],
  "personal|coach|noreview|nolink|noaffil|clients": ["S6", "Y5"],
  "personal|coach|noreview|nolink|noaffil|noclients": ["S6", "Y5"],
  "edu|em|review|nolink|noaffil|clients": ["S17", "Y1"],
  "edu|em|review|nolink|noaffil|noclients": ["S17", "Y1"],
  "edu|em|noreview|nolink|noaffil|clients": ["S18", "Y2"],
  "edu|em|noreview|nolink|noaffil|noclients": ["S18", "Y2"],
  "edu|lead|review|nolink|noaffil|clients": ["S19", "Y8"],
  "edu|lead|review|nolink|noaffil|noclients": ["S19", "Y8"],
  "edu|lead|noreview|nolink|noaffil|clients": ["S20", "Y9"],
  "edu|lead|noreview|nolink|noaffil|noclients": ["S20", "Y9"],
  "edu|admin|review|nolink|noaffil|clients": ["S19", "Y8"],
  "edu|admin|review|nolink|noaffil|noclients": ["S19", "Y8"],
  "edu|admin|noreview|nolink|noaffil|clients": ["S20", "Y9"],
  "edu|admin|noreview|nolink|noaffil|noclients": ["S20", "Y9"],
  "edu|coach|review|nolink|noaffil|clients": ["S5", "Y5"],
  "edu|coach|review|nolink|noaffil|noclients": ["S5", "Y5"],
  "edu|coach|noreview|nolink|noaffil|clients": ["S6", "Y5"],
  "edu|coach|noreview|nolink|noaffil|noclients": ["S6", "Y5"],
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
      // The phone now mirrors this recorded desktop output, except the work
      // item and the board-tree group. The desktop table is unchanged.
      let tree = false;
      const moreLines = (SIDEBAR_LAYOUTS[sidebarId] ?? "").split("\n").filter((line) => {
        if (line.startsWith("# ")) tree = ["# Where it goes", "# Your clients", "# Workboards"].includes(line);
        // MN-3b: the one-row bottom groups carry no heading; they end the tree.
        if (line.startsWith("Look back -> ") || line.startsWith("Your coach -> ")) tree = false;
        return !tree && line !== "All work -> /work";
      });
      const workspaceRows = navFor({ ...c, hasCoachLink: c.coachLink, workItemCount: 0,
        canManageMembers: c.role === "admin" || c.role === "lead",
        canSeeFirmView: c.type === "company" && (c.role === "admin" || c.role === "lead") },
        { vocab: vocabFor({ org_type: c.type }), institutionName: c.affiliated ? "Artemis" : null })
        .filter((group) => group.placement === "workspace_menu").flatMap((group) => group.items)
        .map((item) => item.to ? `${item.label} -> ${item.to}` : `${item.label} [button]`);
      expect(youSheetFor(c)).toBe([...moreLines, "# Workspace", ...workspaceRows].join("\n"));
    });
  }
});


describe("MN-5: From your people in the manifest", () => {
  const base = { role: "em", canReview: false, canManageMembers: false, canSeeFirmView: false,
    hasCoachLink: false, affiliated: false, clientsEnabled: true, workItemCount: 3 };
  const labels = { vocab: vocabFor({ org_type: "partner" }), institutionName: null };
  it("a partner with shared boards gets from_your_people directly below the board tree", () => {
    const ids = navFor({ ...base, type: "partner", partnerShareCount: 2 }, labels).map((g) => g.id);
    expect(ids[ids.indexOf("engagements") + 1]).toBe("from_your_people");
  });
  it("absent with no shares and outside partner workspaces", () => {
    expect(navFor({ ...base, type: "partner", partnerShareCount: 0 }, labels).map((g) => g.id)).not.toContain("from_your_people");
    expect(navFor({ ...base, type: "company", partnerShareCount: 2 }, labels).map((g) => g.id)).not.toContain("from_your_people");
  });
});

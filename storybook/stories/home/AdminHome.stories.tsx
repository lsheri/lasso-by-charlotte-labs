// 21 Nov (D-82): an admin's Home, "what changed", on made-up data shaped like Kestrel Bay. The real lists component and
// the real feed rules (buildAdminFeed); a stand-in sidebar shows where Boards now sits. No phone number, fee or value
// appears anywhere, and every name is invented.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import { AdminWhatChanged } from "@/components/home/AdminHome";
import { buildAdminFeed } from "@/lib/admin-home-shared";
import type { NotificationRow } from "@/lib/notifications-shared";
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";
import type { RosterContact } from "@/lib/roster-shared";

import { AsShipped } from "../proposals/as-shipped";

const NOW = new Date();
const ago = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();

const proposal = (over: Partial<DeskProposal>): DeskProposal => ({
  id: "p", title: "Operating model", clientName: "Pellham", ownerName: "Maren Hollis", mine: true, status: "open",
  receivedAt: ago(30), sentAt: null, decidedAt: null, engagementId: null, contextCount: 2, canAct: true, canClose: true, canArchive: true,
  leadContactId: "c1", leadName: "Corin Ashby", ask: null, ...over,
});
const ask = (over: Partial<NonNullable<DeskProposal["ask"]>>) => ({ name: "Corin Ashby", status: "delivered" as const, reply: null, practice: false, waiting: false, ...over });

const DESK: DeskList = {
  goalHours: 72, canSetGoal: true, canPickLead: true, canAddClient: true, texts: { demo: true, connected: true },
  proposals: [
    proposal({ id: "p1", clientName: "Larkspur", title: "Market access review", leadName: "Tomasz Wieczorek", ask: ask({ name: "Tomasz Wieczorek", status: "undelivered" }), receivedAt: ago(20) }),
    proposal({ id: "p2", clientName: "Quillbrook", title: "Pricing study", receivedAt: ago(78) }),
    proposal({ id: "p3", clientName: "St. Brigid", title: "Diabetes prevention service line", leadContactId: null, leadName: null, receivedAt: ago(2.2) }),
    proposal({ id: "p4", clientName: "Tarnhollow", title: "Launch readiness", leadName: "Aoife Brennan", ask: ask({ name: "Aoife Brennan", reply: "no" }), receivedAt: ago(26) }),
    proposal({ id: "p5", clientName: "Marrowfield", title: "Supplier strategy", leadName: "Priya Raghunathan", ask: ask({ name: "Priya Raghunathan", reply: "yes", recent: true }), receivedAt: ago(28) }),
    proposal({ id: "p6", clientName: "Medrova", title: "Portfolio review", receivedAt: ago(50), sentAt: ago(3.4) }),
    proposal({ id: "p7", clientName: "Ostrander", title: "Due diligence", status: "won", receivedAt: ago(120), sentAt: ago(60), decidedAt: ago(1.1), engagementId: "e7" }),
    proposal({ id: "p8", clientName: "Vale & Finch", title: "Operating model", status: "won", receivedAt: ago(300), decidedAt: ago(40), engagementId: "e8" }),
  ],
};
const ROSTER = [
  { id: "c6", name: "Idris Bello", needsDetails: true },
  { id: "c9", name: "Sun-hee Park", needsDetails: true },
  { id: "c1", name: "Corin Ashby", needsDetails: false },
] as unknown as RosterContact[];
const note = (over: Partial<NotificationRow>): NotificationRow => ({
  id: "n1", org_id: "o", kind: "invite_needs_approval", section: "needs_you", subject_type: "board_invite", subject_id: "i1",
  payload: { by: "Harper Quinn", email: "j.ross@ostrander.example", board: "Ostrander due diligence" }, created_at: ago(0.8), read_at: null, acted_at: null, engagement_id: "e7", ...over,
});
const NOTES = [note({}), note({ id: "n2", kind: "seat_over_count", section: "updates", payload: { seats: 8, filled: 9 }, created_at: ago(5) })];

/** The arriving brief, as a later read would bring it. */
const ARRIVING = proposal({ id: "p9", clientName: "Corrimony", title: "Network redesign", leadContactId: null, leadName: null, receivedAt: ago(0.05) });

/** One router for the story's life, so a later read re-renders the lists instead of rebuilding the page. */
function InRouter({ page }: { page: () => ReactNode }) {
  const [router] = useState(() => createRouter({ routeTree: createRootRoute({ component: () => <>{page()}</> }), history: createMemoryHistory({ initialEntries: ["/home"] }) }));
  return <RouterProvider router={router as never} />;
}

/** A stand-in for the app's menu, drawn to show the order only: Boards sits low and starts closed for an admin. */
function MenuStandIn() {
  const row = "flex h-8 items-center rounded-[var(--radius-md)] px-2 text-(length:--type-small) text-foreground";
  return (
    <aside className="hidden w-[256px] min-w-[256px] shrink-0 flex-col gap-1 border-r border-border bg-muted p-3 md:flex" aria-label="Menu (stand-in)">
      {["Home", "Create", "Firm brain", "Proposals", "All work", "Look back", "Firm view"].map((label) => (
        <span key={label} className={row + (label === "Home" ? " bg-card font-medium" : "")}>{label}</span>
      ))}
      <span className="mt-4 flex items-center justify-between px-2">
        <span className="nb-group-header">Boards</span>
        <span aria-hidden className="text-muted-foreground">›</span>
      </span>
    </aside>
  );
}

function Home(props: { pressed?: boolean; arriving?: boolean }) {
  return (
    <AsShipped>
      <InRouter page={() => <Lists {...props} />} />
    </AsShipped>
  );
}

function Lists({ pressed, arriving }: { pressed?: boolean; arriving?: boolean }) {
  const [desk, setDesk] = useState(DESK);
  useEffect(() => {
    if (!arriving) return;
    const timer = window.setTimeout(() => setDesk((current) => ({ ...current, proposals: [ARRIVING, ...current.proposals] })), 1200);
    return () => window.clearTimeout(timer);
  }, [arriving]);
  useEffect(() => {
    if (!pressed) return;
    const timer = window.setTimeout(() => (document.querySelector('[data-feed-item="wait:p1"] button') as HTMLButtonElement | null)?.click(), 300);
    return () => window.clearTimeout(timer);
  }, [pressed]);
  const feed = buildAdminFeed({ desk, roster: ROSTER, notifications: NOTES, now: new Date() });
  return (
    <div className="flex min-h-screen bg-background">
      <MenuStandIn />
      <main className="min-w-0 flex-1">
        <AdminWhatChanged feed={feed} failed={false} open={desk.proposals.filter((p) => p.status === "open").length} onRetry={() => {}} onStep={() => {}} />
      </main>
    </div>
  );
}

const meta: Meta = { title: "Home/Admin what changed", globals: { skin: "charlotte" }, parameters: { layout: "fullscreen" } };
export default meta;
export const Admin: StoryObj = { render: () => <Home /> };
export const ItemPressed: StoryObj = { render: () => <Home pressed /> };
export const NewItemArrives: StoryObj = { render: () => <Home arriving /> };
export const Loading: StoryObj = {
  render: () => (
    <AsShipped>
      <InRouter page={() => <AdminWhatChanged feed={null} failed={false} open={null} onRetry={() => {}} onStep={() => {}} />} />
    </AsShipped>
  ),
};

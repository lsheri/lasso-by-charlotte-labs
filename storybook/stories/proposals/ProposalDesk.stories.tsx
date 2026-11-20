// The Proposals dashboard as each role sees it, on made-up data shaped like Kestrel Bay. Stand-in handlers only.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { NewProposalDialog } from "@/components/proposals/NewProposalDialog";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { Button } from "@/components/ui/button";
import type { DeskProposal } from "@/lib/proposal-desk-shared";
import { morph } from "@/lib/view-morph";

import { AsShipped } from "./as-shipped";
import { ASK_COPY } from "@/lib/lead-ask-shared";

import { askPreview, desk, NOW, PEOPLE, WON_WORDS } from "./kestrel-bay";

/** The rows link to boards, so they need a router around them. It has one page: the story. */
function InRouter({ children }: { children: ReactNode }) {
  const router = createRouter({ routeTree: createRootRoute({ component: () => <>{children}</> }), history: createMemoryHistory({ initialEntries: ["/"] }) });
  return <RouterProvider router={router as never} />;
}

const ok = async () => ({ ok: true as const });
type Texting = "demo" | "practice" | "real" | "no-agreement";
function Desk({ role, texting = "demo" }: { role: "admin" | "manager" | "analyst"; texting?: Texting }) {
  const picks = role !== "analyst";
  const base = desk(role);
  // The sheet opened from the rows, in each state texting can be in. Stand-ins only: nothing is sent or saved.
  const data = { ...base, texts: { demo: texting === "demo" || texting === "practice", connected: texting !== "practice" } };
  const preview = async () =>
    texting === "no-agreement" ? askPreview("real", ASK_COPY.notAgreedYet("Corin Ashby")) : askPreview(texting === "practice" ? "practice" : texting === "real" ? "real" : "demo");
  return (
    <AsShipped>
      <InRouter>
        <div className="mx-auto max-w-5xl p-4 sm:p-8">
          <ProposalDesk
            data={data}
            now={NOW}
            onSent={ok}
            onWin={async () => ({ ok: true, engagementId: "e0" }) as never}
            onClose={ok}
            roster={picks ? PEOPLE : undefined}
            leadWords={WON_WORDS}
            onLead={picks ? ok : undefined}
            ask={picks ? { preview, send: async () => ({ ok: true, practice: texting === "practice" }), practiceReply: ok } : undefined}
          />
        </div>
      </InRouter>
    </AsShipped>
  );
}

const meta: Meta = { title: "Proposals/Dashboard", globals: { skin: "charlotte" } };
export default meta;
type Story = StoryObj;

export const Admin: Story = { render: () => <Desk role="admin" /> };
export const Manager: Story = { render: () => <Desk role="manager" /> };
export const Analyst: Story = { render: () => <Desk role="analyst" /> };
export const AdminPractice: Story = { render: () => <Desk role="admin" texting="practice" /> };
export const AdminReal: Story = { render: () => <Desk role="admin" texting="real" /> };
export const AdminNoAgreement: Story = { render: () => <Desk role="admin" texting="no-agreement" /> };

/**
 * New proposal, then straight into picking its lead (21 Nov 2026). Stand-ins only: "Start proposal" adds a row to
 * this story's own list, and nothing is saved, uploaded or sent.
 */
function StartThenPick({ role }: { role: "admin" | "analyst" }) {
  // State lives inside the router, so a change of state does not rebuild the router and blank the story.
  return (
    <AsShipped>
      <InRouter>
        <StartThenPickInner role={role} />
      </InRouter>
    </AsShipped>
  );
}
function StartThenPickInner({ role }: { role: "admin" | "analyst" }) {
  const base = desk(role);
  const [rows, setRows] = useState(base.proposals);
  const [open, setOpen] = useState(true);
  const [startLead, setStartLead] = useState<string | null>(null);
  const picks = role !== "analyst";
  return (
        <div className="mx-auto max-w-5xl p-4 sm:p-8">
          <Button type="button" onClick={() => setOpen(true)}>New proposal</Button>
          <ProposalDesk
            data={{ ...base, proposals: rows }}
            now={NOW}
            roster={picks ? PEOPLE : undefined}
            leadWords={WON_WORDS}
            onLead={picks ? ok : undefined}
            ask={picks ? { preview: async () => askPreview("practice"), send: async () => ({ ok: true, practice: true }), practiceReply: ok } : undefined}
            startLead={startLead}
            onStartLeadDone={() => setStartLead(null)}
          />
          <NewProposalDialog
            open={open}
            onOpenChange={setOpen}
            clients={[{ id: "11111111-1111-4111-8111-111111111111", name: "Marrowfield" }]}
            clientsLoading={false}
            profileId="22222222-2222-4222-8222-222222222222"
            capture={async () => ({ ids: [], failures: [] })}
            create={async (input) => {
              const made = { ...(base.proposals[0] as DeskProposal), id: "made-here", title: input.title, clientName: "Marrowfield", status: "open", leadContactId: null, leadName: null, ask: null, sentAt: null, receivedAt: NOW.toISOString(), contextCount: 0 } as DeskProposal;
              await new Promise((resolve) => setTimeout(resolve, 300));
              setRows((current) => [made, ...current]);
              return { ok: true, id: made.id };
            }}
            onCreated={async (id) => {
              if (picks) await morph(() => { setOpen(false); setStartLead(id); });
            }}
          />
        </div>
  );
}
export const StartThenPickAdmin: Story = { render: () => <StartThenPick role="admin" /> };
export const StartThenPickAnalyst: Story = { render: () => <StartThenPick role="analyst" /> };

// The Proposals dashboard as each role sees it, on made-up data shaped like Kestrel Bay. Stand-in handlers only.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { Button } from "@/components/ui/button";
import type { DeskProposal } from "@/lib/proposal-desk-shared";

import { AsShipped } from "./as-shipped";
import { ASK_COPY, leadAskBody } from "@/lib/lead-ask-shared";

import { askPreview, desk, FIRM, NOW, PEOPLE, WON_WORDS } from "./kestrel-bay";
import { LIVE_NOW, LIVE_PEOPLE, liveDesk } from "./kestrel-bay-live";

/** The rows link to boards, so they need a router around them. It has one page: the story. */
function InRouter({ children }: { children: ReactNode }) {
  const router = createRouter({ routeTree: createRootRoute({ component: () => <>{children}</> }), history: createMemoryHistory({ initialEntries: ["/"] }) });
  return <RouterProvider router={router as never} />;
}

const ok = async () => ({ ok: true as const });
type Texting = "demo" | "practice" | "real" | "no-agreement";
function Desk({ role, texting = "demo", winning = false }: { role: "admin" | "manager" | "analyst"; texting?: Texting; winning?: boolean }) {
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
            onWin={winning ? () => new Promise<never>(() => {}) : async () => ({ ok: true, engagementId: "e0" }) as never}
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
/** D-86: press Record the win, then Make the team board, to see the board build in. The stand-in never finishes. */
export const AdminWinning: Story = { render: () => <Desk role="admin" winning /> };

// 21 Nov 2026, click path cards: New proposal is now the proposal step card; see Proposals/Step cards.

/**
 * D-86, the live Kestrel Bay shapes: Pellham with no lead, Larkspur with Christy Johnson and her refused test ask,
 * and past work beside each name in the lead sheet. Stand-ins only: nothing is saved or sent.
 */
function LiveDesk({ role, sheet = false, winning = false }: { role: "admin" | "manager" | "analyst"; sheet?: boolean; winning?: boolean }) {
  const picks = role !== "analyst";
  const preview = async (_proposalId: string, contactId?: string) => {
    const person = LIVE_PEOPLE.find((p) => p.id === contactId);
    return { ...askPreview("demo"), name: person?.name ?? "", words: leadAskBody({ brandName: "Lasso", firmName: FIRM, leadName: person?.name ?? "", askerName: "Maren Hollis" }) };
  };
  return (
    <AsShipped>
      <InRouter>
        <div className="mx-auto max-w-5xl p-4 sm:p-8">
          <ProposalDesk
            data={liveDesk(role)}
            now={LIVE_NOW}
            onSent={ok}
            onWin={winning ? () => new Promise<never>(() => {}) : async () => ({ ok: true, engagementId: "e0" }) as never}
            onClose={ok}
            roster={picks ? LIVE_PEOPLE : undefined}
            leadWords={WON_WORDS}
            onLead={picks ? ok : undefined}
            ask={picks ? { preview, send: async () => ({ ok: true, practice: false }), practiceReply: ok } : undefined}
            startLead={sheet ? "pellham" : null}
          />
        </div>
      </InRouter>
    </AsShipped>
  );
}
export const LiveAdmin: Story = { render: () => <LiveDesk role="admin" /> };
export const LiveLead: Story = { render: () => <LiveDesk role="manager" /> };
export const LiveMember: Story = { render: () => <LiveDesk role="analyst" /> };
export const LiveAdminLeadSheet: Story = { render: () => <LiveDesk role="admin" sheet /> };
export const LiveAdminWinning: Story = { render: () => <LiveDesk role="admin" winning /> };

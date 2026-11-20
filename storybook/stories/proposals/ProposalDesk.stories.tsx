// The Proposals dashboard as each role sees it, on made-up data shaped like Kestrel Bay. Stand-in handlers only.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { ProposalDesk } from "@/components/proposals/ProposalDesk";

import { AsShipped } from "./as-shipped";
import { askPreview, desk, NOW, PEOPLE, WON_WORDS } from "./kestrel-bay";

/** The rows link to boards, so they need a router around them. It has one page: the story. */
function InRouter({ children }: { children: ReactNode }) {
  const router = createRouter({ routeTree: createRootRoute({ component: () => <>{children}</> }), history: createMemoryHistory({ initialEntries: ["/"] }) });
  return <RouterProvider router={router as never} />;
}

const ok = async () => ({ ok: true as const });
function Desk({ role }: { role: "admin" | "manager" | "analyst" }) {
  const picks = role !== "analyst";
  return (
    <AsShipped>
      <InRouter>
        <div className="mx-auto max-w-5xl p-4 sm:p-8">
          <ProposalDesk
            data={desk(role)}
            now={NOW}
            onSent={ok}
            onWin={async () => ({ ok: true, engagementId: "e0" }) as never}
            onClose={ok}
            roster={picks ? PEOPLE : undefined}
            leadWords={WON_WORDS}
            onLead={picks ? ok : undefined}
            ask={picks ? { preview: async () => askPreview("demo"), send: async () => ({ ok: true, practice: false }), practiceReply: ok } : undefined}
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

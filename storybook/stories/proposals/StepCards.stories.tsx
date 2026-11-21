// 21 Nov 2026, click path cards: every click-path step card as each role meets it, over a page that goes soft, on
// made-up data shaped like Kestrel Bay. Stand-in handlers only: nothing is read, saved or sent.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";

import { LeadDocumentDialog } from "@/components/home/LeadDocumentDialog";
import { LeadFinalCard } from "@/components/home/LeadFinalCard";
import { ApprovalReview } from "@/components/proposals/ApprovalReview";
import { LeadSheet } from "@/components/proposals/LeadSheet";
import { LeadSheetCard } from "@/components/proposals/LeadSheetCard";
import { ProposalDesk } from "@/components/proposals/ProposalDesk";
import { ProposalFlow } from "@/components/proposals/ProposalFlow";
import { SendDocsCard } from "@/components/proposals/SendDocsCard";
import { Button } from "@/components/ui/button";
import type { BriefReading } from "@/lib/brief-read-shared";
import { leadAskBody, type AskPreview } from "@/lib/lead-ask-shared";
import type { DeskList, DeskProposal } from "@/lib/proposal-desk-shared";

import { AsShipped } from "./as-shipped";
import { desk, FIRM, NOW, PEOPLE, WON_WORDS } from "./kestrel-bay";

const PROFILE = "33333333-3333-4333-8333-333333333333";
const HARBOR = "44444444-4444-4444-8444-444444444444";
const BRIEF = `Hi Maren,

Harbor Health wants a staffing model review across its three hospitals ahead of the spring budget. We would like a proposal by Friday 27 November, with an approach, a team and a timeline.

Thanks, Dana Ruiz, Chief Operating Officer`;
const READING: BriefReading = {
  client: { name: "Harbor Health", id: HARBOR },
  ask: "A staffing model review across its three hospitals",
  due: { phrase: "Friday 27 November", date: "2026-11-27" },
  notes: BRIEF,
  readBy: "model",
};
const NEW: DeskProposal = {
  id: "p-new",
  title: READING.ask!,
  clientName: "Harbor Health",
  ownerName: "Maren Hollis",
  mine: true,
  status: "open",
  receivedAt: "2026-11-20T15:00:00Z",
  sentAt: null,
  decidedAt: null,
  engagementId: null,
  contextCount: 2,
  contextTitles: ["Harbor Health RFP.pdf", "Staffing data 2025.xlsx"],
  canAct: true,
  canClose: true,
  canArchive: true,
  leadContactId: null,
  leadName: "Corin Ashby",
  leadDocs: "unsent",
  ask: null,
  dueOn: "2026-11-27",
} as DeskProposal;

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const preview = async (_id: string, contactId: string): Promise<AskPreview> => {
  const person = PEOPLE.find((p) => p.id === contactId) ?? PEOPLE[0]!;
  return {
    ok: true,
    mode: "demo",
    warning: null,
    name: person.name,
    words: leadAskBody({ brandName: "Lasso", firmName: FIRM, leadName: person.name, askerName: "Maren Hollis" }),
  };
};

/**
 * The rows behind link to boards, so the page needs a router. It is made once, around the page only (which never
 * changes); the card, which holds the story's state, sits outside it. QA L3 of PR 304: a router rebuilt on every
 * render blanked the story after any change of state.
 */
function InRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() => {
    const page = children;
    return createRouter({
      routeTree: createRootRoute({ component: () => <>{page}</> }),
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
  });
  return <RouterProvider router={router as never} />;
}

/** A plain app frame: the menu stays sharp, the page (data-pill-behind) goes soft behind a card. */
function Shell({ page, children, title }: { page: ReactNode; children: ReactNode; title: string }) {
  return (
    <AsShipped>
      <InRouter>
        <div className="flex min-h-screen bg-background text-foreground">
          <nav className="hidden w-[236px] shrink-0 flex-col gap-1 border-r border-border bg-secondary p-4 md:flex" aria-label="Menu">
            <b className="mb-4 tracking-[0.2em]">CHARLOTTE</b>
            {["Home", "Proposals", "Firm brain", "Boards"].map((item) => (
              <span key={item} className="rounded-[var(--radius-control)] px-3 py-2 text-(length:--type-small)" data-on={item === title || undefined}>
                {item}
              </span>
            ))}
          </nav>
          <div className="min-w-0 flex-1" data-pill-behind="">
            <div className="mx-auto max-w-5xl p-4 sm:p-8">{page}</div>
          </div>
        </div>
      </InRouter>
      {children}
    </AsShipped>
  );
}

function ProposalsPageBehind() {
  return (
    <>
      <h1 className="mb-6 text-(length:--type-display) font-semibold">Proposals</h1>
      <ProposalDesk data={desk("admin")} now={NOW} roster={PEOPLE} />
    </>
  );
}

/* ----- Admin: New proposal, the three steps ----- */
function AdminNewProposal({ role = "admin" }: { role?: "admin" | "lead" }) {
  const [open, setOpen] = useState(true);
  const [client] = useState(() => {
    const q = new QueryClient();
    const list: DeskList = { ...desk("admin"), proposals: [NEW, ...desk("admin").proposals] };
    q.setQueryData(["proposal-desk", PROFILE], list);
    return q;
  });
  return (
    <QueryClientProvider client={client}>
      <Shell title="Proposals" page={<ProposalsPageBehind />}>
        <div className="fixed right-4 top-4">
          <Button onClick={() => setOpen(true)}>New proposal ({role})</Button>
        </div>
        <ProposalFlow
          open={open}
          onOpenChange={setOpen}
          mayStart
          tools={{
            profileId: PROFILE,
            goalHours: 72,
            read: async () => {
              await wait(1200);
              return READING;
            },
            clients: async () => [{ id: HARBOR, name: "Harbor Health" }],
            capture: async (files) => ({ ids: files.map((_, i) => `w${i}`), failures: [] }),
            discard: async () => undefined,
            create: async () => {
              await wait(300);
              return { ok: true, id: "p-new" };
            },
          }}
          passTools={{ admins: async () => ({ name: "Maren", count: 1 }), pass: async () => ({ ok: true, admins: 1 }) }}
          firmName={FIRM}
          brandName="Charlotte"
          sendDocs={async () => ({ ok: true })}
          reduceMotion={false}
          leadStep={(_id, done, onState) => (
            <LeadSheet
              inline
              target={{ proposal: { ...NEW, leadName: null }, start: "pick", fresh: true }}
              roster={PEOPLE}
              wonWords={WON_WORDS}
              demo
              connected
              preview={preview}
              send={async () => {
                await wait(400);
                return { ok: true, practice: false } as never;
              }}
              onSave={async () => ({ ok: true })}
              onClose={done}
              onState={onState}
            />
          )}
        />
      </Shell>
    </QueryClientProvider>
  );
}

/* ----- A Member: pass a brief from Home ----- */
function MemberPassBrief() {
  const [open, setOpen] = useState(true);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <Shell title="Home" page={<HomeBehind name="Elif" />}>
        <ProposalFlow
          open={open}
          onOpenChange={setOpen}
          mayStart={false}
          tools={{
            profileId: PROFILE,
            goalHours: 72,
            read: async () => READING,
            clients: async () => [],
            capture: async () => ({ ids: [], failures: [] }),
            discard: async () => undefined,
            create: async () => ({ ok: false, problem: "no" }),
          }}
          passTools={{
            admins: async () => ({ name: "Maren", count: 1 }),
            pass: async () => {
              await wait(300);
              return { ok: true, admins: 1 };
            },
          }}
          firmName={FIRM}
          brandName="Charlotte"
          sendDocs={async () => ({ ok: true })}
          reduceMotion={false}
        />
      </Shell>
    </QueryClientProvider>
  );
}

function HomeBehind({ name }: { name: string }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-center text-(length:--type-display) font-semibold">Good afternoon, {name}</h1>
      <p className="text-center text-muted-foreground">Up next, what changed, and your boards.</p>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="h-16 rounded-[var(--corner-panel)] border border-border bg-card" />
      ))}
    </div>
  );
}

/* ----- Admin from a row: Send the documents ----- */
function AdminSendDocs() {
  const [open, setOpen] = useState(true);
  return (
    <Shell title="Proposals" page={<ProposalsPageBehind />}>
      <SendDocsCard
        open={open}
        onOpenChange={setOpen}
        leadName="Corin Ashby"
        titles={NEW.contextTitles ?? []}
        count={2}
        onSend={async () => {
          await wait(400);
          return { ok: true };
        }}
      />
    </Shell>
  );
}

/* ----- Admin from a row or Home: Pick the lead, then ask them ----- */
function AdminLeadSheet({ start }: { start: "pick" | "confirm" }) {
  const [open, setOpen] = useState(true);
  return (
    <Shell title="Proposals" page={<ProposalsPageBehind />}>
      <LeadSheetCard
        target={open ? { proposal: { ...NEW, leadContactId: start === "confirm" ? "c1" : null }, start } : null}
        roster={PEOPLE}
        wonWords={WON_WORDS}
        demo
        connected
        preview={preview}
        send={async () => ({ ok: true, practice: false }) as never}
        onSave={async () => ({ ok: true })}
        onClose={() => setOpen(false)}
      />
    </Shell>
  );
}

/* ----- A Lead on Home: decide the final, read what was sent ----- */
function LeadFinal() {
  return (
    <Shell title="Home" page={<HomeBehind name="Corin" />}>
      <div className="fixed left-1/2 top-24 w-[min(560px,90vw)] -translate-x-1/2 rounded-[var(--corner-panel)] border border-border bg-card p-4">
        <LeadFinalCard
          proposalId="p-new"
          client="Harbor Health"
          final={null}
          documents={[
            { id: "d1", title: "Harbor Health RFP.pdf" },
            { id: "d2", title: "Staffing data 2025.xlsx" },
          ]}
          tools={{
            choose: async () => ({ ok: true, final: { itemId: "d1", title: "Harbor Health RFP.pdf", source: "document", chosenAt: "2026-11-21T10:00:00Z", gone: false } }) as never,
            draft: async () => {
              await wait(800);
              return { ok: true, itemId: "dr", title: "Harbor Health proposal draft", gaps: 2, questions: 3 } as never;
            },
            upload: async () => ({ ids: [], failures: [] }),
          }}
        />
      </div>
    </Shell>
  );
}

const DOC = `Harbor Health: staffing model review

Background
Harbor Health runs three hospitals in the Bay area. Nurse turnover rose last year and agency spend followed.

What we are asked for
A review of the staffing model across all three sites, with options the board can act on before the spring budget.

Approach
Week 1 to 2: listen and map. Week 3 to 5: test options with unit leaders. Week 6: recommend.`;
const DOC_MEMBER = `${DOC}

Fees
[withheld]`;

function LeadDocument({ member = false }: { member?: boolean }) {
  const [open, setOpen] = useState<{ proposalId: string; itemId: string; title: string } | null>({
    proposalId: "p-new",
    itemId: "d1",
    title: "Harbor Health RFP.pdf",
  });
  return (
    <QueryClientProvider client={new QueryClient()}>
      <Shell title="Home" page={<HomeBehind name={member ? "Elif" : "Corin"} />}>
        <LeadDocumentDialog
          open={open}
          onClose={() => setOpen(null)}
          read={async () => ({ ok: true, title: "Harbor Health RFP.pdf", text: member ? DOC_MEMBER : DOC, withheld: member }) as never}
        />
      </Shell>
    </QueryClientProvider>
  );
}

/* ----- Phase 5 (PR 303): the Lead sends the final for approval; an admin reviews it ----- */
function LeadSendForApproval() {
  return (
    <Shell title="Home" page={<HomeBehind name="Corin" />}>
      <div className="fixed left-1/2 top-24 w-[min(560px,90vw)] -translate-x-1/2 rounded-[var(--corner-panel)] border border-border bg-card p-4">
        <LeadFinalCard
          proposalId="p-new"
          client="Harbor Health"
          final={{ itemId: "d9", title: "Harbor Health proposal, final", source: "draft", chosenAt: "2026-11-21T10:00:00Z", gone: false } as never}
          documents={[]}
          tools={{ choose: async () => ({ ok: true }) as never, draft: async () => ({ ok: true }) as never, upload: async () => ({ ids: [], failures: [] }) }}
          approval={{
            stage: "ready_to_send",
            view: null,
            ask: async () => {
              await wait(400);
              return { ok: true } as never;
            },
          }}
        />
      </div>
    </Shell>
  );
}

function AdminApproval() {
  return (
    <Shell title="Proposals" page={<ProposalsPageBehind />}>
      <div className="fixed left-1/2 top-24 w-[min(560px,90vw)] -translate-x-1/2 rounded-[var(--corner-panel)] border border-border bg-card p-4">
        <ApprovalReview
          approval={{ id: "a1", state: "waiting", requestedBy: "Corin Ashby", requestedAt: "2026-11-21T10:00:00Z", decidedBy: null, decidedAt: null, note: null, finalItemId: "d9", finalTitle: "Harbor Health proposal, final", stale: false }}
          leadName="Corin Ashby"
          proposalId="p-new"
          decide={async () => {
            await wait(400);
            return { ok: true } as never;
          }}
          readFinal={async () => ({ ok: true, title: "Harbor Health proposal, final", text: DOC })}
        />
      </div>
    </Shell>
  );
}

const meta: Meta = { title: "Proposals/Step cards", globals: { skin: "charlotte" }, parameters: { layout: "fullscreen" } };
export default meta;
type Story = StoryObj;

export const AdminNewProposalStory: Story = { name: "Admin new proposal", render: () => <AdminNewProposal /> };
export const LeadNewProposalStory: Story = { name: "Lead new proposal", render: () => <AdminNewProposal role="lead" /> };
export const AdminPickLeadFromRow: Story = { name: "Admin pick lead from row", render: () => <AdminLeadSheet start="pick" /> };
export const AdminAskLeadFromRow: Story = { name: "Admin ask lead from row", render: () => <AdminLeadSheet start="confirm" /> };
export const AdminSendDocuments: Story = { name: "Admin send documents", render: () => <AdminSendDocs /> };
export const LeadDecideFinal: Story = { name: "Lead decide final", render: () => <LeadFinal /> };
export const LeadReadDocument: Story = { name: "Lead read document", render: () => <LeadDocument /> };
export const MemberLeadReadDocument: Story = { name: "Member lead read document", render: () => <LeadDocument member /> };
export const LeadSendForApprovalStory: Story = { name: "Lead send for approval", render: () => <LeadSendForApproval /> };
export const AdminApprovalStory: Story = { name: "Admin approval", render: () => <AdminApproval /> };
export const MemberPassBriefStory: Story = { name: "Member pass brief", render: () => <MemberPassBrief /> };

// The one sheet where a lead is picked and asked, on made-up data shaped like Kestrel Bay. Stand-in handlers only.
import type { Meta, StoryObj } from "@storybook/react-vite";

import { LeadSheet, type LeadSheetStart, type PastWork } from "@/components/proposals/LeadSheet";
import { ASK_COPY, leadAskBody, type AskPreview } from "@/lib/lead-ask-shared";
import type { DeskProposal } from "@/lib/proposal-desk-shared";

import { AsShipped } from "./as-shipped";
import { FIRM, PEOPLE, PROPOSALS, WON_WORDS } from "./kestrel-bay";

const open = PROPOSALS[0] as DeskProposal;
const asked = PROPOSALS[1] as DeskProposal;
const nothing = () => {};

type Mode = "real" | "demo" | "practice";
const previewFor =
  (mode: Mode) =>
  async (_proposalId: string, contactId: string): Promise<AskPreview> => {
    const person = PEOPLE.find((p) => p.id === contactId);
    if (!person) return { ok: false, problem: ASK_COPY.missing };
    const words = leadAskBody({
      brandName: "Lasso",
      firmName: FIRM,
      leadName: person.name,
      askerName: "Maren Hollis",
    });
    const warning =
      mode === "real" && person.texts !== "agreed" ? ASK_COPY.notAgreedYet(person.name) : null;
    return { ok: true, words, name: person.name, mode, warning };
  };

const PAST: Record<string, PastWork[]> = {
  c1: [
    { client: "Marrowfield", title: "Network redesign" },
    { client: "Quillbrook", title: "Pricing study" },
  ],
  c4: [{ client: "Tarnhollow", title: "Supplier strategy" }],
  c8: [
    { client: "Medrova", title: "Due diligence" },
    { client: "Ostrander", title: "Portfolio review" },
    { client: "Corrimony", title: "Launch readiness" },
    { client: "Vale & Finch", title: "Operating model" },
  ],
};

function Sheet({
  proposal,
  start,
  mode,
  pastWork,
}: {
  proposal: DeskProposal;
  start: LeadSheetStart;
  mode: Mode;
  pastWork?: Record<string, PastWork[]>;
}) {
  return (
    <AsShipped>
      <LeadSheet
        target={{ proposal, start }}
        roster={PEOPLE}
        wonWords={WON_WORDS}
        demo={mode !== "real"}
        preview={previewFor(mode)}
        send={async () => ({ ok: true, practice: mode === "practice" })}
        onSave={async () => ({ ok: true })}
        onClose={nothing}
        pastWork={pastWork}
      />
    </AsShipped>
  );
}

const meta: Meta = { title: "Proposals/One sheet", globals: { skin: "charlotte" } };
export default meta;
type Story = StoryObj;

export const PickNobodyYet: Story = {
  render: () => <Sheet proposal={open} start="pick" mode="real" />,
};
export const PickWithOnePicked: Story = {
  render: () => <Sheet proposal={asked} start="pick" mode="real" />,
};
export const PickWithPastWork: Story = {
  render: () => <Sheet proposal={asked} start="pick" mode="real" pastWork={PAST} />,
};
export const ConfirmReal: Story = {
  render: () => <Sheet proposal={asked} start="confirm" mode="real" />,
};
export const ConfirmDemoWorkspace: Story = {
  render: () => <Sheet proposal={asked} start="confirm" mode="demo" />,
};
export const ConfirmPractice: Story = {
  render: () => <Sheet proposal={asked} start="confirm" mode="practice" />,
};
export const ConfirmNoAgreement: Story = {
  render: () => (
    <Sheet
      proposal={{ ...asked, leadContactId: "c2", leadName: "Mina Okafor" }}
      start="confirm"
      mode="real"
    />
  ),
};

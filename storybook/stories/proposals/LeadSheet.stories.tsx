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
  (mode: Mode, people = PEOPLE) =>
  async (_proposalId: string, contactId: string): Promise<AskPreview> => {
    const person = people.find((p) => p.id === contactId);
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
  people = PEOPLE,
}: {
  proposal: DeskProposal;
  start: LeadSheetStart;
  mode: Mode;
  pastWork?: Record<string, PastWork[]>;
  people?: typeof PEOPLE;
}) {
  return (
    <AsShipped>
      <LeadSheet
        target={{ proposal, start }}
        roster={people}
        wonWords={WON_WORDS}
        demo={mode !== "real"}
        connected={mode !== "practice"}
        preview={previewFor(mode, people)}
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
/** Texting is not switched on: a practice ask. Nothing on the list may say or imply a text is sent. */
export const PickSenderOff: Story = {
  render: () => <Sheet proposal={asked} start="pick" mode="practice" />,
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

/** A first name of 35 unbroken letters: the label above the phone must wrap so Cancel and Send stay on the screen. */
const LONG_NAME = "Wolfeschlegelsteinhausenbergerdorff Ashby";
const LONG_PEOPLE = PEOPLE.map((p) => (p.id === "c1" ? { ...p, name: LONG_NAME } : p));
const longAsked = { ...asked, leadName: LONG_NAME } as DeskProposal;
export const ConfirmVeryLongFirstName: Story = {
  render: () => <Sheet proposal={longAsked} start="confirm" mode="real" people={LONG_PEOPLE} />,
};
export const PickVeryLongFirstName: Story = {
  render: () => <Sheet proposal={longAsked} start="pick" mode="real" people={LONG_PEOPLE} />,
};

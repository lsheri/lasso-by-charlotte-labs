// Asking someone to lead, on made-up data shaped like Kestrel Bay. Nothing here can send or save: every handler
// is a stand-in that answers at once.
import type { Meta, StoryObj } from "@storybook/react-vite";

import { AskDialog } from "@/components/proposals/AskLead";
import { LeadDialog } from "@/components/proposals/LeadPicker";
import { ASK_COPY } from "@/lib/lead-ask-shared";
import type { DeskProposal } from "@/lib/proposal-desk-shared";

import { AsShipped } from "./as-shipped";
import { askPreview, PEOPLE, PROPOSALS, WON_WORDS } from "./kestrel-bay";

const open = PROPOSALS[0] as DeskProposal;
const asked = PROPOSALS[1] as DeskProposal;
const nothing = () => {};

const meta: Meta = {
  title: "Proposals/Asking a lead",
  globals: { skin: "charlotte" },
  decorators: [(Story) => <AsShipped><Story /></AsShipped>],
};
export default meta;
type Story = StoryObj;

export const PickTheLead: Story = {
  render: () => <LeadDialog proposal={open} roster={PEOPLE} words={WON_WORDS} demo onClose={nothing} onSave={async () => ({ ok: true })} />,
};
export const PickTheLeadWithOnePicked: Story = {
  render: () => <LeadDialog proposal={asked} roster={PEOPLE} words={WON_WORDS} onClose={nothing} onSave={async () => ({ ok: true })} />,
};
export const NobodyOnTheList: Story = {
  render: () => <LeadDialog proposal={open} roster={[]} words={WON_WORDS} onClose={nothing} onSave={async () => ({ ok: true })} />,
};
const ask = (mode: "real" | "demo" | "practice", warning: string | null = null): Story => ({
  render: () => <AskDialog proposal={asked} load={async () => askPreview(mode, warning)} send={async () => ({ ok: true, practice: mode === "practice" })} onClose={nothing} />,
});
export const AskReal = ask("real");
export const AskDemoWorkspace = ask("demo");
export const AskPractice = ask("practice");
export const AskNoAgreement = ask("real", ASK_COPY.notAgreedYet("Corin Ashby"));
export const AskCouldNotLoad: Story = {
  render: () => <AskDialog proposal={asked} load={async () => ({ ok: false, problem: ASK_COPY.missing })} send={async () => ({ ok: true, practice: false })} onClose={nothing} />,
};

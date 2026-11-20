// Record the win, on made-up data. Nothing here can save: the handler is a stand-in.
import type { Meta, StoryObj } from "@storybook/react-vite";

import { WinDialog } from "@/components/proposals/ProposalDesk";
import type { DeskProposal } from "@/lib/proposal-desk-shared";

import { AsShipped } from "./as-shipped";
import { PROPOSALS } from "./kestrel-bay";

const base = PROPOSALS[0] as DeskProposal;
const nothing = () => {};
const meta: Meta = {
  title: "Proposals/Record the win",
  globals: { skin: "charlotte" },
  decorators: [(Story) => <AsShipped><Story /></AsShipped>],
};
export default meta;
type Story = StoryObj;

const win = (over: Partial<DeskProposal>): Story => ({
  render: () => <WinDialog proposal={{ ...base, ...over }} onClose={nothing} onWin={async () => ({ ok: false, problem: "This is a picture only. Nothing was made." })} />,
});
export const TwoDocuments = win({ contextCount: 2, contextTitles: ["Discovery call notes", "Marrowfield RFP.pdf"] });
export const NoDocuments = win({ contextCount: 0, contextTitles: [] });
export const ManyDocuments = win({ contextCount: 9, contextTitles: ["Discovery call notes", "Marrowfield RFP.pdf", "Network audit 2025", "Pricing model", "Org chart", "Last year's proposal", "Site list", "Security questionnaire", "Budget letter"] });
export const LongTitles = win({ contextCount: 2, contextTitles: ["Marrowfield regional network redesign request for proposal final version 3 signed.pdf", "Notesfromthediscoverycallwithnospacesatallinthefilenamewhatsoever.docx"] });

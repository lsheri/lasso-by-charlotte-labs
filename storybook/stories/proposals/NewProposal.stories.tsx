// New proposal, on made-up data. Nothing here can save or upload: every handler is a stand-in.
import type { Meta, StoryObj } from "@storybook/react-vite";

import { NewProposalDialog } from "@/components/proposals/NewProposalDialog";

import { AsShipped } from "./as-shipped";

const CLIENTS = [
  { id: "11111111-1111-4111-8111-111111111111", name: "Marrowfield" },
  { id: "11111111-1111-4111-8111-111111111112", name: "Quillbrook" },
  { id: "11111111-1111-4111-8111-111111111113", name: "Pellham County Public Health" },
];
let n = 0;
const capture = async (files: File[]) => ({ ids: files.map(() => `44444444-4444-4444-8444-${String(++n).padStart(12, "0")}`), failures: [] });

const meta: Meta = {
  title: "Proposals/New proposal",
  globals: { skin: "charlotte" },
  decorators: [(Story) => <AsShipped><Story /></AsShipped>],
};
export default meta;
type Story = StoryObj;

const dialog = (over: Partial<Parameters<typeof NewProposalDialog>[0]> = {}): Story => ({
  render: () => (
    <NewProposalDialog
      open
      onOpenChange={() => {}}
      clients={CLIENTS}
      clientsLoading={false}
      profileId="22222222-2222-4222-8222-222222222222"
      capture={capture}
      create={async () => ({ ok: false, problem: "This is a picture only. Nothing was made." })}
      onCreated={() => {}}
      {...over}
    />
  ),
});
export const Admin = dialog();
export const Member = dialog({ canAddClient: false });
export const MemberWithNoClients = dialog({ canAddClient: false, clients: [] });
export const NoClientsYet = dialog({ clients: [] });

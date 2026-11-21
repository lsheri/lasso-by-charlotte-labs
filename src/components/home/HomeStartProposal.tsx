import { useState } from "react";

import { ProposalFlowMount } from "@/components/proposals/ProposalFlowMount";
import { Button } from "@/components/ui/button";
import { Plus } from "@/design/brand/icons";
import { mayStartInChat } from "@/lib/pill-proposal-shared";
import { HOME_START_COPY } from "@/lib/proposal-flow-shared";

/**
 * 21 Nov 2026, click path cards (Liam: "the click through experience ... opens cards with the proposal steps ... it
 * shouldnt open chat"). Home's way to start a proposal without the chat: one quiet button that opens the proposal
 * step card. An admin or a lead starts it; anyone else passes the brief to an admin, as the chat does. Outline, so the
 * one filled button on Home stays the most urgent next step (D-86).
 */
export function HomeStartProposal({
  profile,
}: {
  profile: { id?: string | null; role?: string | null; org_name?: string | null };
}) {
  const [open, setOpen] = useState(false);
  if (!profile.id) return null;
  const starts = mayStartInChat(profile.role);
  const C = starts ? HOME_START_COPY.start : HOME_START_COPY.pass;
  return (
    <section data-testid="home-start-proposal" className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-(length:--type-small) text-muted-foreground">{C.line}</p>
      <Button type="button" variant="outline" onClick={() => setOpen(true)} data-home-start="">
        <Plus aria-hidden className="size-4" />
        {C.button}
      </Button>
      <ProposalFlowMount
        open={open}
        onOpenChange={setOpen}
        profileId={profile.id}
        mayStart={starts}
        firmName={profile.org_name ?? ""}
      />
    </section>
  );
}

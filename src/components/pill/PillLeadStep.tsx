import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { LeadSheet } from "@/components/proposals/LeadSheet";
import { useProposalDesk } from "@/components/proposals/use-proposal-desk";
import { useBrandCopy } from "@/components/skin/use-skin";
import { askLeadFn, askPreviewFn } from "@/lib/lead-ask.functions";
import { PROPOSAL_CARD_COPY } from "@/lib/pill-proposal-shared";
import { pastWorkByLead } from "@/lib/proposal-desk-shared";
import { setProposalLeadFn } from "@/lib/proposal-desk.functions";
import { linkTeammateFn, listRosterFn } from "@/lib/roster.functions";
import { wonTextBody } from "@/lib/won-text-shared";

/**
 * 20 Nov 2026, chat pill PR 3b: the lead sheet inside the chat's proposal card. It is Proposals' own sheet (the same
 * people, words, preview, practice or real ask and save), read from the same desk and roster queries, so the chat and
 * the page can never disagree about who leads it or what was sent. Closing it carries the card on to Proposals.
 */
export function PillLeadStep({
  proposalId,
  profileId,
  firmName,
  onDone,
}: {
  proposalId: string;
  profileId: string;
  firmName: string;
  onDone: () => void;
}) {
  const queryClient = useQueryClient();
  const brand = useBrandCopy();
  const desk = useProposalDesk(profileId);
  const roster = useQuery({
    queryKey: ["proposal-desk-roster", profileId],
    queryFn: () => listRosterFn({ data: { profile_id: profileId } }),
    staleTime: 30_000,
    retry: false,
  });
  const proposal = desk.data?.proposals.find(
    (row) => row.id === proposalId && row.status === "open",
  );
  // Someone who may not pick, or a list that cannot be read, goes on to Proposals, where the row says what to do.
  const cannot = Boolean(
    (desk.data && !desk.data.canPickLead) ||
    (roster.data && !roster.data.allowed) ||
    desk.isError ||
    roster.isError,
  );
  useEffect(() => {
    if (cannot) onDone();
  }, [cannot, onDone]);
  if (cannot) return null;
  if (!desk.data || !proposal || !roster.data) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {PROPOSAL_CARD_COPY.peopleLoading}
      </p>
    );
  }
  return (
    <LeadSheet
      inline
      target={{ proposal, start: "pick", fresh: true }}
      roster={roster.data.allowed ? roster.data.contacts : undefined}
      wonWords={wonTextBody({ brandName: brand("Lasso"), firmName })}
      demo={desk.data.texts.demo}
      connected={desk.data.texts.connected}
      preview={(id, contactId) =>
        askPreviewFn({
          data: { profile_id: profileId, proposal_id: id, lead_contact_id: contactId ?? null },
        })
      }
      send={async (id, pressId) => {
        const result = await askLeadFn({
          data: { profile_id: profileId, proposal_id: id, press_id: pressId },
        });
        await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
        return result;
      }}
      onSave={async (id, contactId) => {
        const result = await setProposalLeadFn({
          data: { profile_id: profileId, proposal_id: id, lead_contact_id: contactId },
        });
        if (result.ok) {
          await queryClient.invalidateQueries({ queryKey: ["proposal-desk"] });
          void roster.refetch();
        }
        return result;
      }}
      pastWork={pastWorkByLead(desk.data.proposals)}
      teammates={roster.data.allowed ? roster.data.teammates : undefined}
      linkTeammate={async (teammateId) => {
        const result = await linkTeammateFn({ data: { profile_id: profileId, teammate_id: teammateId } });
        if (result.ok) void roster.refetch();
        return result;
      }}
      onClose={onDone}
    />
  );
}
